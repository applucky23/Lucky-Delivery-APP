from django.urls import path
from .views import (TaskListCreateView, TaskRetrieveApIView, TaskUpdateView,
                    TaskCancelAPIView, AcceptTaskAPIView, RejectTaskAPIView,
                    ManualAssignTaskAPIView, DriverAssignmentsView, DriverActiveTaskView,
                    MarkArrivedAPIView, SubmitItemAmountAPIView, VerifyReceiptAPIView,
                    CompleteTaskAPIView, ConfirmPaymentAPIView, StartDeliveryAPIView,
                    DoneShoppingAPIView, ArriveAtDropoffAPIView,
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
    path('tasks/<int:task_id>/manual-assign/', ManualAssignTaskAPIView.as_view(), name='task-manual-assign'),
    path('tasks/<int:task_id>/mark-arrived/', MarkArrivedAPIView.as_view(), name='task-mark-arrived'),
    path('tasks/<int:task_id>/start-delivery/', StartDeliveryAPIView.as_view(), name='task-start-delivery'),
    path('tasks/<int:task_id>/submit-amount/', SubmitItemAmountAPIView.as_view(), name='task-submit-item-amount'),
    path('tasks/<int:task_id>/verify-receipt/', VerifyReceiptAPIView.as_view(), name='task-verify-receipt'),
    path('tasks/<int:task_id>/done-shopping/', DoneShoppingAPIView.as_view(), name='task-done-shopping'),
    path('tasks/<int:task_id>/arrive-at-dropoff/', ArriveAtDropoffAPIView.as_view(), name='task-arrive-at-dropoff'),
    path('tasks/<int:task_id>/complete/', CompleteTaskAPIView.as_view(), name='task-complete'),
    path('tasks/<int:task_id>/confirm-payment/', ConfirmPaymentAPIView.as_view(), name='task-confirm-payment'),
]