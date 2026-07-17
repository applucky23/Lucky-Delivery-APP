from django.urls import path
from .views import PayCommissionView, CommissionPaymentHistoryView, CancelCommissionPaymentView, DriverEarningsView

urlpatterns = [
    path('driver/earnings/',                  DriverEarningsView.as_view(),              name='driver-earnings'),
    path('driver/pay-commission/',            PayCommissionView.as_view(),               name='driver-pay-commission'),
    path('driver/commission-payments/',       CommissionPaymentHistoryView.as_view(),    name='driver-commission-payments'),
    path('driver/cancel-commission-payment/', CancelCommissionPaymentView.as_view(),     name='driver-cancel-commission-payment'),
]
