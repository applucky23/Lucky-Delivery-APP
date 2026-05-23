from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, UpdateAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from customers.models import Task, DriverProfile
from .permissions import IsTaskOwnerOrAdminOrDriver, IsOwnerOrAdmin, IsDriver, IsAdminUser
from .services.cancel_task import cancel
from .services.task_assignment import dispatch
from .services.geo_validation import validate_driver_at_pickup, mark_task_arrived
from .services.task_progression import submit_item_amount, approve_price, reject_price, start_delivery
from .services.task_accept_reject import accept_task, reject_task
from .services.manual_assignments import manual_assign
from .services.receipt_verification import verify_receipt
from .services.task_completion import complete_task
from .services.task_validation import validate_user_can_create_task, validate_task_can_be_updated
from .serializers import TaskSerializer, TaskDetailSerializer, AdminTaskSerializer
from .utils import get_task_or_404, get_driver_profile_or_404


logger = logging.getLogger(__name__)


class TaskListCreateView(APIView):
    """Handle task creation and listing with role-based filtering"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get tasks - users see their active tasks, admins see all active tasks"""
        try:
            user = request.user

            queryset = Task.objects.exclude(
                status__in=['COMPLETED', 'CANCELLED']
            ).select_related('user', 'driver').order_by('-created_at')

            if user.role != 'ADMIN':
                queryset = queryset.filter(user=user)

            task_type = request.query_params.get('type')
            if task_type:
                queryset = queryset.filter(type=task_type)

            serializer = TaskSerializer(queryset, many=True)
            return Response(serializer.data)

        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while fetching tasks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """Create a new task with automatic user assignment"""
        try:
            user = request.user
            validate_user_can_create_task(user)

            data = request.data.copy()
            data['user'] = user.id

            if user.role == 'ADMIN':
                serializer = AdminTaskSerializer(data=data)
            else:
                serializer = TaskSerializer(data=data)

            if serializer.is_valid():
                task = serializer.save(user=request.user)
                dispatch(task)

                if user.role == 'ADMIN':
                    response_serializer = AdminTaskSerializer(task)
                else:
                    response_serializer = TaskSerializer(task)

                return Response(response_serializer.data, status=status.HTTP_201_CREATED)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while creating the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskRetrieveApIView(RetrieveAPIView):
    """Retrieve task details with permission checks"""
    queryset = Task.objects.select_related('user', 'driver')
    permission_classes = [IsAuthenticated, IsTaskOwnerOrAdminOrDriver]
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
        kwargs['partial'] = self.request.method == 'PATCH'
        return super().get_serializer(*args, **kwargs)

    def perform_update(self, serializer):
        try:
            task = self.get_object()
            validate_task_can_be_updated(task)
            serializer.save()
        except ValidationError as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError({'error': str(e)})
        except Exception:
            from rest_framework.exceptions import APIException
            raise APIException('An unexpected error occurred while updating the task')


class TaskCancelAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def post(self, request, task_id):
        """Cancel a task"""
        try:
            task = get_task_or_404(task_id, select_related=['driver'])
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            cancel(task, request.user)
            return Response(
                {'message': f'Task #{task.id} has been successfully cancelled'},
                status=status.HTTP_200_OK
            )
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while cancelling the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AcceptTaskAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        """Accept a task - driver accepts a task they were assigned to"""
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id)
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = accept_task(task, driver_profile)
            if not result['success']:
                status_code = status.HTTP_409_CONFLICT if result.get('already_taken') else status.HTTP_400_BAD_REQUEST
                return Response({'error': result['message']}, status=status_code)
            return Response({'message': result['message']}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while accepting the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RejectTaskAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        """Reject a task - driver rejects a task they were assigned to"""
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id)
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = reject_task(task, driver_profile)
            if not result['success']:
                return Response({'error': result['message']}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result['message']}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while rejecting the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ManualAssignTaskAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, task_id):
        """Admin manually assigns a driver to a task, bypassing matching"""
        driver_id = request.data.get('driver_id')
        if not driver_id:
            return Response({'error': 'driver_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = get_task_or_404(task_id)
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            driver_profile = DriverProfile.objects.get(id=driver_id, is_verified=True)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver not found or not verified'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = manual_assign(task, driver_profile, admin=request.user)
            if not result['success']:
                return Response({'error': result['message']}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result['message']}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while assigning the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MarkArrivedAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if task.driver != driver_profile:
            return Response(
                {'error': 'You are not assigned to this task'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status != 'ASSIGNED':
            return Response(
                {'error': f'Task cannot be marked as arrived from status {task.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_driver_at_pickup(driver_profile, task)
            mark_task_arrived(task, driver_profile)
            return Response({'message': 'Arrival confirmed'}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while marking arrival'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StartDeliveryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['user', 'driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            start_delivery(task, driver_profile)
            return Response({'message': 'Delivery started'}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while starting delivery'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SubmitItemAmountAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if task.driver != driver_profile:
            return Response(
                {'error': 'You are not assigned to this task'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status != 'ARRIVED':
            return Response(
                {'error': f'Cannot submit amount from status {task.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reported_amount = request.data.get('amount')
        if reported_amount is None:
            return Response({'error': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reported_amount = float(reported_amount)
            if reported_amount <= 0:
                return Response(
                    {'error': 'Amount must be greater than 0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response({'error': 'Amount must be a number'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            submit_item_amount(task, driver_profile, reported_amount)
            return Response({'message': 'Item amount submitted for approval'}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while submitting item amount'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ApprovePriceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def post(self, request, task_id):
        try:
            task = get_task_or_404(task_id, select_related=['user'])
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        if task.user != request.user and request.user.role != 'ADMIN':
            return Response(
                {'error': 'You do not have permission to approve this task'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status != 'AWAITING_APPROVAL':
            return Response(
                {'error': f'Cannot approve task from status {task.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            approve_price(task, request.user)
            return Response({'message': 'Price approved successfully'}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while approving price'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RejectPriceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def post(self, request, task_id):
        try:
            task = get_task_or_404(task_id, select_related=['user'])
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        if task.user != request.user and request.user.role != 'ADMIN':
            return Response(
                {'error': 'You do not have permission to reject this task'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status != 'AWAITING_APPROVAL':
            return Response(
                {'error': f'Cannot reject task from status {task.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reject_price(task, request.user)
            return Response({'message': 'Price rejected and task cancelled'}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while rejecting price'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VerifyReceiptAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        image_url = request.data.get('image_url')
        receipt_type = request.data.get('type')

        if not image_url:
            return Response({'error': 'image_url is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not receipt_type:
            return Response({'error': 'type is required (RECEIPT or SMS)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                try:
                    task = Task.objects.select_related('user', 'driver').select_for_update().get(id=task_id)
                except Task.DoesNotExist:
                    return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

                if task.driver != driver_profile:
                    return Response(
                        {'error': 'You are not assigned to this task'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                verify_receipt(task, driver_profile, image_url, receipt_type)

            return Response(
                {'message': 'Receipt verified, task is now in delivery'},
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('Unexpected error verifying receipt for task %s', task_id)
            return Response(
                {'error': 'An unexpected error occurred while verifying receipt'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CompleteTaskAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['user', 'driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            complete_task(task, driver_profile)
            return Response(
                {'message': f'Task #{task.id} completed successfully'},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while completing the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
