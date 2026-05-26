from django.urls import path
from .views import (TaskListCreateView, TaskRetrieveApIView, TaskUpdateView,
                    TaskCancelAPIView, AcceptTaskAPIView, RejectTaskAPIView,
                    ManualAssignTaskAPIView,MarkArrivedAPIView,SubmitItemAmountAPIView,
                    ApprovePriceAPIView,RejectPriceAPIView,VerifyReceiptAPIView,
                    CompleteTaskAPIView,StartDeliveryAPIView,TaskEstimateAPIView,
                    )



urlpatterns = [
    path('tasks/estimate/', TaskEstimateAPIView.as_view(), name='task-estimate'),
    path('tasks/', TaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/<int:task_id>/', TaskRetrieveApIView.as_view(), name='task-retrieve'),
    path('tasks/<int:task_id>/update/', TaskUpdateView.as_view(), name='task-detail-update'),
    path('tasks/<int:task_id>/cancel/', TaskCancelAPIView.as_view(), name='task-cancel'),
    path('tasks/<int:task_id>/accept/', AcceptTaskAPIView.as_view(), name='task-accept'),
    path('tasks/<int:task_id>/reject/', RejectTaskAPIView.as_view(), name='task-reject'),
    path('tasks/<int:task_id>/manual-assign/', ManualAssignTaskAPIView.as_view(), name='task-manual-assign'),
    path('tasks/<int:task_id>/mark-arrived/', MarkArrivedAPIView.as_view(), name='task-mark-arrived'),
    path('tasks/<int:task_id>/start-delivery/', StartDeliveryAPIView.as_view(), name='task-start-delivery'),
    path('tasks/<int:task_id>/submit-amount/', SubmitItemAmountAPIView.as_view(), name='task-submit-item-amount'),
    path('tasks/<int:task_id>/approve-price/', ApprovePriceAPIView.as_view(), name='task-approve-price'),
    path('tasks/<int:task_id>/reject-price/', RejectPriceAPIView.as_view(), name='task-reject-price'),
    path('tasks/<int:task_id>/verify-receipt/', VerifyReceiptAPIView.as_view(), name='task-verify-receipt'),
    path('tasks/<int:task_id>/complete/', CompleteTaskAPIView.as_view(), name='task-complete'),

]