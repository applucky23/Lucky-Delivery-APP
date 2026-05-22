from django.urls import path
from .views import (TaskListCreateView, TaskRetrieveApIView, TaskUpdateView,
                    TaskCancelAPIView, AcceptTaskAPIView, RejectTaskAPIView,
                    ManualAssignTaskAPIView, DriverAssignmentsView, DriverActiveTaskView,
                    TaskTransitionView, ApprovePurchaseView,
                    )

urlpatterns = [
    path('tasks/', TaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/driver/assignments/', DriverAssignmentsView.as_view(), name='driver-assignments'),
    path('tasks/driver/active/', DriverActiveTaskView.as_view(), name='driver-active-task'),
    path('tasks/<int:task_id>/', TaskRetrieveApIView.as_view(), name='task-retrieve'),
    path('tasks/<int:task_id>/update/', TaskUpdateView.as_view(), name='task-detail-update'),
    path('tasks/<int:task_id>/cancel/', TaskCancelAPIView.as_view(), name='task-cancel'),
    path('tasks/<int:task_id>/accept/', AcceptTaskAPIView.as_view(), name='task-accept'),
    path('tasks/<int:task_id>/reject/', RejectTaskAPIView.as_view(), name='task-reject'),
    path('tasks/<int:task_id>/transition/', TaskTransitionView.as_view(), name='task-transition'),
    path('tasks/<int:task_id>/approve/', ApprovePurchaseView.as_view(), name='task-approve'),
    path('tasks/<int:task_id>/manual-assign/', ManualAssignTaskAPIView.as_view(), name='task-manual-assign'),
]