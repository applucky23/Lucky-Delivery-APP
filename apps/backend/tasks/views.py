import math
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, UpdateAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from customers.models import Task, DriverProfile, TaskAssignment
from .permissions import IsTaskOwnerOrAdminOrDriver, IsOwnerOrAdmin, IsDriver, IsAdminUser
from .services.cancel_task import cancel
from .services.task_assignment import dispatch
from .services.geo_validation import check_arrival_distance, mark_task_arrived
from .services.task_progression import submit_item_amount, start_delivery, done_shopping, arrive_at_dropoff
from .services.task_accept_reject import accept_task, reject_task
from .services.manual_assignments import manual_assign
from .services.receipt_verification import verify_receipt
from .services.task_completion import complete_task, confirm_payment
from .services.task_validation import validate_user_can_create_task, validate_task_can_be_updated
from .serializers import TaskSerializer, TaskDetailSerializer, AdminTaskSerializer, TaskAssignmentSerializer
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
                status='CANCELLED'
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

                # Calculate estimated distance and price
                from math import radians, cos, sin, asin, sqrt
                def _haversine(lat1, lon1, lat2, lon2):
                    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                    dlon = lon2 - lon1
                    dlat = lat2 - lat1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    return c * 6371

                dist = _haversine(
                    float(task.pickup_lat), float(task.pickup_lng),
                    float(task.dropoff_lat), float(task.dropoff_lng)
                )
                size_premium_map = {'up_to_2kg': 10, 'up_to_6kg': 20, 'up_to_10kg': 30}
                size_premium = size_premium_map.get(task.item_size, 0)

                if task.type == 'ERRAND' and dist < 0.01:
                    # No pickup needed — single location errand
                    task.estimated_price = 30
                elif task.type == 'ERRAND':
                    # Round trip: pickup → errand → back to pickup
                    task.estimated_price = 30 + round(dist * 20)
                else:
                    # DELIVERY / SHOPPING standard pricing + size premium
                    distance_charge = 30 if dist <= 1 else 30 + int(dist - 1) * 10
                    task.estimated_price = distance_charge + size_premium

                if task.priority == 'urgent':
                    task.estimated_price = math.ceil(task.estimated_price * 1.2)

                if task.type == 'ERRAND' and dist >= 0.01:
                    task.estimated_distance_km = round(dist * 2, 2)  # round trip
                else:
                    task.estimated_distance_km = round(dist, 2)
                task.save(update_fields=['estimated_distance_km', 'estimated_price'])

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


class DriverAssignmentsView(APIView):
    """
    GET /api/v1/tasks/driver/assignments/
    Returns all PENDING task assignments for the authenticated driver.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

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
            driver_profile = get_driver_profile_or_404(request.user)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        active_task = Task.objects.filter(
            driver=driver_profile,
            status__in=['ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING', 'AWAITING_PAYMENT']
        ).select_related('user').order_by('-created_at').first()

        if not active_task:
            return Response({'error': 'No active task'}, status=status.HTTP_404_NOT_FOUND)

        return Response(TaskDetailSerializer(active_task).data)


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

        mark_task_arrived(task, driver_profile)
        response = {'message': 'Arrival confirmed'}
        distance = check_arrival_distance(driver_profile, task)
        if distance and distance > 300:
            response['warning'] = True
            response['distance'] = distance
        return Response(response, status=status.HTTP_200_OK)


class StartDeliveryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['user', 'driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        logger.info(f"[StartDelivery] task={task.id} type={task.type} status={task.status} driver={driver_profile.id}")
        try:
            start_delivery(task, driver_profile)
            logger.info(f"[StartDelivery] OK — task={task.id} now at status={task.status}")
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





class DoneShoppingAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id)
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            done_shopping(task, driver_profile)
            return Response(
                {'message': 'Shopping completed, on the way!'},
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('Error in done_shopping for task %s', task_id)
            return Response(
                {'error': 'An unexpected error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ArriveAtDropoffAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id)
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if task.driver != driver_profile:
            return Response({'error': 'Not your task'}, status=status.HTTP_403_FORBIDDEN)

        try:
            arrive_at_dropoff(task, driver_profile)
            serializer = TaskDetailSerializer(task, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('Error in arrive_at_dropoff for task %s', task_id)
            return Response(
                {'error': 'An unexpected error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                    task = Task.objects.select_related('user', 'driver').get(id=task_id)
                except Task.DoesNotExist:
                    return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

                if task.driver != driver_profile:
                    return Response(
                        {'error': 'You are not assigned to this task'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                verify_receipt(task, driver_profile, image_url, receipt_type)

            return Response(
                {'message': 'Receipt uploaded, will be cross-checked by admin'},
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

        logger.info(f"[CompleteTask] task={task.id} type={task.type} status={task.status} driver={driver_profile.id}")
        try:
            result = complete_task(task, driver_profile)
            logger.info(f"[CompleteTask] OK — task={task.id} now at status={task.status}")
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as e:
            logger.warning(f"[CompleteTask] ValueError for task={task.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while completing the task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConfirmPaymentAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, task_id):
        try:
            driver_profile = get_driver_profile_or_404(request.user)
            task = get_task_or_404(task_id, select_related=['user', 'driver'])
        except (Task.DoesNotExist, DriverProfile.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            confirm_payment(task, driver_profile)
            return Response(
                {'message': f'Task #{task.id} completed successfully'},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while confirming payment'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
