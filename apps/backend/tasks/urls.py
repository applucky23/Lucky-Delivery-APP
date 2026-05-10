from django.urls import path
from .views import (TaskListCreateView, TaskRetrieveApIView, TaskUpdateView,
                    TaskCancelAPIView, AcceptTaskAPIView, RejectTaskAPIView,
                    ManualAssignTaskAPIView,
                    )



urlpatterns = [
    path('tasks/', TaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/<int:task_id>/', TaskRetrieveApIView.as_view(), name='task-retrieve'),
    path('tasks/<int:task_id>/update/', TaskUpdateView.as_view(), name='task-detail-update'),
    path('tasks/<int:task_id>/cancel/', TaskCancelAPIView.as_view(), name='task-cancel'),
    path('tasks/<int:task_id>/accept/', AcceptTaskAPIView.as_view(), name='task-accept'),
    path('tasks/<int:task_id>/reject/', RejectTaskAPIView.as_view(), name='task-reject'),
    path('tasks/<int:task_id>/manual-assign/', ManualAssignTaskAPIView.as_view(), name='task-manual-assign'),

]