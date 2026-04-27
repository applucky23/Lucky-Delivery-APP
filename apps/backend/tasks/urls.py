from django.urls import path
from .views import TaskListCreateView, TaskRetrieveApIView, TaskUpdateView, TaskCancelAPIView



urlpatterns = [
    path('tasks/', TaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/<int:task_id>/', TaskRetrieveApIView.as_view(), name='task-retrieve'),
    path('tasks/<int:task_id>/update/', TaskUpdateView.as_view(), name='task-detail-update'),
    path('tasks/<int:task_id>/cancel/', TaskCancelAPIView.as_view(), name='task-cancel'),
]
