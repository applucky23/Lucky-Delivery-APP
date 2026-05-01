from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView,UpdateAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, serializers
from django_filters.rest_framework import DjangoFilterBackend
from customers.models import Task
from .permissions import IsTaskOwnerOrAdminOrDriver,IsOwnerOrAdmin
from .services.cancel_task import cancel
from .services.task_validation import validate_user_can_create_task, validate_task_can_be_updated
from .serializers import TaskSerializer, TaskDetailSerializer, AdminTaskSerializer


# Create your views here.

# TODO: Trigger notification (TASK_CREATED) via notifications app
class TaskListCreateView(APIView):
    """Handle task creation and listing with role-based filtering"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get tasks - users see their active tasks, admins see all active tasks"""
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


    def post(self, request):
        """Create a new task with automatic user assignment"""
        # TODO: EVENT -> TASK_CREATED (trigger driver matching + notifications later)
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
            
            # Return appropriate response based on user role
            if user.role == 'ADMIN':
                response_serializer = AdminTaskSerializer(task)
            else:
                response_serializer = TaskSerializer(task)
            
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



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
        task = self.get_object()
        validate_task_can_be_updated(task)
        serializer.save()


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
        except Exception as e:
            return Response(
                {'error': 'An unexpected error occurred'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


