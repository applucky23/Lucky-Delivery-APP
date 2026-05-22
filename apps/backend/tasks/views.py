from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView,UpdateAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, serializers
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import ValidationError
from customers.models import Task, DriverProfile, TaskAssignment
from .permissions import IsTaskOwnerOrAdminOrDriver,IsOwnerOrAdmin,IsDriver,IsAdminUser
from .services.cancel_task import cancel
from .services.task_assignment import dispatch
from .services.task_accept_reject import accept_task,reject_task
from .services.manual_assignments import manual_assign
from .services.task_validation import validate_user_can_create_task, validate_task_can_be_updated
from .serializers import TaskSerializer, TaskDetailSerializer, AdminTaskSerializer, TaskAssignmentSerializer


# Create your views here.

class TaskListCreateView(APIView):
    """Handle task creation and listing with role-based filtering"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get tasks - users see their active tasks, admins see all active tasks"""
        try:
            user = request.user

            # Base queryset - only active tasks (not completed or cancelled)
            queryset = Task.objects.exclude(
                status__in=['COMPLETED', 'CANCELLED']
            ).select_related('user', 'driver').order_by('-created_at')

            # Role-based filtering
            if user.role == 'ADMIN':
                # Admins see all active tasks
                pass
            else:
                # Regular users only see their own tasks
                queryset = queryset.filter(user=user)

            # Optional filtering by type
            task_type = request.query_params.get('type')
            if task_type:
                queryset = queryset.filter(type=task_type)

            serializer = TaskSerializer(queryset, many=True)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while fetching tasks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    def post(self, request):
        """Create a new task with automatic user assignment"""
        try:
            user = request.user

            # Validate user can create task
            validate_user_can_create_task(user)

            # Create a copy of request data to modify
            data = request.data.copy()

            # Ensure the task is assigned to current user
            data['user'] = user.id

            # Use appropriate serializer based on user role
            if user.role == 'ADMIN':
                serializer = AdminTaskSerializer(data=data)
            else:
                serializer = TaskSerializer(data=data)

            if serializer.is_valid():
                task = serializer.save(user=request.user)
                # TODO: EVENT -> TASK_CREATED (trigger driver matching + notifications later)
                dispatch(task)

                # Return appropriate response based on user role
                if user.role == 'ADMIN':
                    response_serializer = AdminTaskSerializer(task)
                else:
                    response_serializer = TaskSerializer(task)

                return Response(response_serializer.data, status=status.HTTP_201_CREATED)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while creating the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



class TaskRetrieveApIView(RetrieveAPIView):
    """Retrieve task details with permission checks"""
    queryset = Task.objects.select_related('user', 'driver')
    permission_classes = [IsAuthenticated,IsTaskOwnerOrAdminOrDriver]
    lookup_field = 'id'
    lookup_url_kwarg = 'task_id'

    def get_serializer_class(self):
        if self.request.user.role == 'ADMIN':
            return AdminTaskSerializer
        return TaskDetailSerializer


class TaskUpdateView(UpdateAPIView):
    """Handle individual task updates with partial update support"""
    queryset = Task.objects.select_related('user', 'driver')
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    lookup_field = 'id'
    lookup_url_kwarg = 'task_id'

    def get_serializer_class(self):
        if self.request.user.role == 'ADMIN':
            return AdminTaskSerializer
        return TaskDetailSerializer

    def get_serializer(self, *args, **kwargs):
        """Ensure partial updates are supported"""
        kwargs['partial'] = self.request.method == 'PATCH'
        return super().get_serializer(*args, **kwargs)

    def perform_update(self, serializer):
        """Validate task can be updated before saving"""
        try:
            task = self.get_object()
            validate_task_can_be_updated(task)
            serializer.save()
        except ValidationError as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError({'error': str(e)})
        except Exception as e:
            from rest_framework.exceptions import APIException
            raise APIException('An unexpected error occurred while updating the task')


class TaskCancelAPIView(APIView):
    permission_classes = [IsAuthenticated,IsOwnerOrAdmin]

    def post(self, request, task_id):
        """Cancel a task - soft delete a task (only if user is admin or task owner and task is in appropriate status)"""
        try:
            task = Task.objects.get(id=task_id)
            cancel(task,request.user)
            return Response(
                {'message': f'Task #{task.id} has been successfully cancelled'},
                status=status.HTTP_200_OK
            )
        except Task.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while cancelling the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AcceptTaskAPIView(APIView):
    permission_classes = [IsAuthenticated,IsDriver]

    def post(self, request, task_id):
        """Accept a task - driver accepts a task they were assigned to"""
        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': 'Driver profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while fetching driver profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            task = Task.objects.get(id=task_id)
            result = accept_task(task, driver_profile)
            if not result['success']:
                status_code = status.HTTP_409_CONFLICT if result.get('already_taken') else status.HTTP_400_BAD_REQUEST
                return Response({'error': result['message']}, status=status_code)

            return Response({'message': result['message']}, status=status.HTTP_200_OK)

        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'An unexpected error occurred while accepting the task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RejectTaskAPIView(APIView):
    permission_classes = [IsAuthenticated,IsDriver]

    def post(self, request, task_id):
        """Reject a task - driver rejects a task they were assigned to"""
        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': 'Driver profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while fetching driver profile'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            task = Task.objects.get(id=task_id)
            result = reject_task(task, driver_profile)
            if not result['success']:
                return Response({'error': result['message']}, status=status.HTTP_400_BAD_REQUEST)

            return Response({'message': result['message']}, status=status.HTTP_200_OK)

        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'An unexpected error occurred while rejecting the task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class ManualAssignTaskAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, task_id):
        """Admin manually assigns a driver to a task, bypassing matching"""
        driver_id = request.data.get('driver_id')
        if not driver_id:
            return Response(
                {'error': 'driver_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            task = Task.objects.get(id=task_id)
            driver_profile = DriverProfile.objects.get(id=driver_id)
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = manual_assign(task, driver_profile, admin=request.user)

            if not result['success']:
                return Response({'error': result['message']}, status=status.HTTP_400_BAD_REQUEST)

            return Response({'message': result['message']}, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred while assigning the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DriverAssignmentsView(APIView):
    """
    GET /api/v1/tasks/driver/assignments/
    Returns all PENDING task assignments for the authenticated driver.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'[Assignments] driver_id={driver_profile.id} name={driver_profile.full_name} user_role={request.user.role}')

        all_assignments = TaskAssignment.objects.filter(driver=driver_profile)
        logger.info(f'[Assignments] total for driver: {all_assignments.count()} | pending: {all_assignments.filter(outcome="PENDING").count()}')
        for a in all_assignments:
            logger.info(f'[Assignments]   id={a.id} task#{a.task_id} outcome={a.outcome}')

        assignments = (
            TaskAssignment.objects
            .filter(driver=driver_profile, outcome='PENDING')
            .select_related('task', 'task__user')
            .order_by('-notified_at')
        )
        serializer = TaskAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)


class DriverActiveTaskView(APIView):
    """
    GET /api/v1/tasks/driver/active/
    Returns the driver's current active task (ASSIGNED, ARRIVED, etc.)
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        active_task = Task.objects.filter(
            driver=driver_profile,
            status__in=['ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING']
        ).select_related('user').order_by('-created_at').first()

        if not active_task:
            return Response({'error': 'No active task'}, status=status.HTTP_404_NOT_FOUND)

        return Response(TaskDetailSerializer(active_task).data)


class TaskTransitionView(APIView):
    """
    POST /api/v1/tasks/{task_id}/transition/
    Driver advances the task through FSM states.
    Body: { "action": "mark_arrived" | "request_approval" | "start_delivery" | "complete_task" }
    """
    permission_classes = [IsAuthenticated, IsDriver]

    ALLOWED_TRANSITIONS = {
        'mark_arrived':      'ASSIGNED',
        'request_approval':  'ARRIVED',
        'start_delivery':    'PURCHASED',
        'complete_task':     'DELIVERING',
    }

    def post(self, request, task_id):
        from django.db import transaction

        action = request.data.get('action')
        if action not in self.ALLOWED_TRANSITIONS:
            return Response(
                {'error': f'Invalid action. Must be one of: {list(self.ALLOWED_TRANSITIONS.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                task = Task.objects.select_for_update().get(id=task_id, driver=driver_profile)

                required_status = self.ALLOWED_TRANSITIONS[action]
                if task.status != required_status:
                    return Response(
                        {'error': f'Cannot perform "{action}" — task is {task.status}, expected {required_status}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                getattr(task, action)()
                task.save()

                if action == 'complete_task':
                    driver_profile.is_available = True
                    driver_profile.save(update_fields=['is_available'])

            return Response(TaskDetailSerializer(task).data, status=status.HTTP_200_OK)

        except Task.DoesNotExist:
            return Response({'error': 'Task not found or not assigned to you'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ApprovePurchaseView(APIView):
    """
    POST /api/v1/tasks/{task_id}/approve/
    Customer approves the purchase price so driver can start delivery.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        from django.db import transaction

        try:
            with transaction.atomic():
                task = Task.objects.select_for_update().get(id=task_id, user=request.user)

                if task.status != 'AWAITING_APPROVAL':
                    return Response(
                        {'error': f'Task is {task.status}, not awaiting approval'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                task.approve_purchase()
                task.save()

            return Response(TaskDetailSerializer(task).data)

        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'[Approve] error: {e}')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
