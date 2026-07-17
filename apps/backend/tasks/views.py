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
from .services.task_creation import create_task
from .services.geo_validation import check_arrival_distance, mark_task_arrived, MAX_ARRIVAL_DISTANCE_METERS
from .services.task_progression import submit_item_amount, approve_price, reject_price, start_delivery
from .services.task_accept_reject import accept_task, reject_task
from .services.manual_assignments import manual_assign
from .services.receipt_verification import verify_receipt
from .services.task_completion import complete_task
from .services.task_validation import validate_user_can_create_task, validate_task_can_be_updated
from .services.pricing import calculate_estimated_price
from .serializers import TaskSerializer, TaskDetailSerializer, AdminTaskSerializer
from .utils import get_task_or_404, get_driver_profile_or_404


from core.services.maps.routing import get_route_data
from core.services.capabilities import assert_vehicle_capable


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
                with transaction.atomic():
                    task = serializer.save(user=request.user)
                    create_task(task)

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
    queryset = Task.objects.select_related('user', 'driver', 'driver__user')
    permission_classes = [IsAuthenticated, IsTaskOwnerOrAdminOrDriver]
    lookup_field = 'id'
    lookup_url_kwarg = 'task_id'

    def get_serializer_class(self):
        if self.request.user.role == 'ADMIN':
            return AdminTaskSerializer
        return TaskDetailSerializer


class TaskUpdateView(UpdateAPIView):
    """Handle individual task updates with partial update support"""
    queryset = Task.objects.select_related('user', 'driver', 'driver__user')
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
            task = get_task_or_404(task_id, select_related=['driver', 'driver__user'])
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
            task = get_task_or_404(task_id, select_related=['driver'])
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
            from customers.models import DriverLocation
            try:
                driver_location = DriverLocation.objects.get(driver=driver_profile)
            except DriverLocation.DoesNotExist:
                return Response({'error': 'Driver location not found'}, status=status.HTTP_400_BAD_REQUEST)
            
            distance = check_arrival_distance(driver_profile, task, driver_location=driver_location)
            
            response_data = {'message': 'Arrival confirmed'}
            if distance is not None and distance > MAX_ARRIVAL_DISTANCE_METERS:
                response_data['warning'] = f'You are {distance}m away from pickup location (threshold: {MAX_ARRIVAL_DISTANCE_METERS}m)'
            
            mark_task_arrived(task, driver_profile)
            return Response(response_data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'An unexpected error occurred while marking arrival'},
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


class TaskEstimateAPIView(APIView):
    """
    POST /tasks/estimate/
    Returns estimated distance, duration, and price for given coordinates
    without creating a task. Used by the frontend as a price preview.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        required = ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng', 'vehicle_type', 'type']
        for field in required:
            if not request.data.get(field):
                return Response({'error': f'{field} is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pickup_lat  = float(request.data['pickup_lat'])
            pickup_lng  = float(request.data['pickup_lng'])
            dropoff_lat = float(request.data['dropoff_lat'])
            dropoff_lng = float(request.data['dropoff_lng'])
        except (ValueError, TypeError):
            return Response({'error': 'Coordinates must be valid numbers'}, status=status.HTTP_400_BAD_REQUEST)

        vehicle_type  = request.data['vehicle_type']
        task_type     = request.data['type']
        is_return_trip = request.data.get('is_return_trip', False)

        valid_vehicle_types = ['ON_FOOT', 'BICYCLE', 'MOTORCYCLE', 'CAR', 'MINI_TRUCK']
        valid_task_types    = ['DELIVERY', 'SHOPPING', 'ERRAND']

        if vehicle_type not in valid_vehicle_types:
            return Response({'error': f'Invalid vehicle_type. Must be one of: {valid_vehicle_types}'}, status=status.HTTP_400_BAD_REQUEST)

        if task_type not in valid_task_types:
            return Response({'error': f'Invalid type. Must be one of: {valid_task_types}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            route = get_route_data(
                origin=(pickup_lat, pickup_lng),
                destination=(dropoff_lat, dropoff_lng),
                vehicle_type=vehicle_type,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assert_vehicle_capable(vehicle_type, route['distance_km'])
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        estimated_price = calculate_estimated_price(
            task_type=task_type,
            distance_km=route['distance_km'],
            vehicle_type=vehicle_type,
            is_return_trip=bool(is_return_trip),
        )

        return Response({
            'distance_km':       route['distance_km'],
            'duration_minutes':  route['duration_minutes'],
            'estimated_price':   str(estimated_price),
            'vehicle_type':      vehicle_type,
            'type':              task_type,
            'is_return_trip':    bool(is_return_trip),
        }, status=status.HTTP_200_OK)
