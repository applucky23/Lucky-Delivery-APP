import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum, Case, When, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.permissions import IsDriver

from customers.models import CommissionPayment, DriverProfile, WalletTransaction

logger = logging.getLogger(__name__)


def _earnings_totals(profile, now):
    """Single-query earnings aggregation for daily/weekly/monthly totals."""
    _D = DecimalField(max_digits=10, decimal_places=2)
    return WalletTransaction.objects.filter(driver=profile, type='EARNING').aggregate(
        daily=Coalesce(Sum(Case(
            When(created_at__gte=now - timedelta(hours=24), then='amount'),
            output_field=_D,
        )), Value(0, output_field=_D)),
        weekly=Coalesce(Sum(Case(
            When(created_at__gte=now - timedelta(days=7), then='amount'),
            output_field=_D,
        )), Value(0, output_field=_D)),
        monthly=Coalesce(Sum(Case(
            When(created_at__gte=now - timedelta(days=30), then='amount'),
            output_field=_D,
        )), Value(0, output_field=_D)),
    )


class DriverEarningsView(APIView):
    """
    GET /api/v1/driver/earnings/
    Returns the driver's earnings balance + rolling daily/weekly/monthly totals.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        totals = _earnings_totals(profile, timezone.now())

        return Response({
            'balance': str(profile.balance),
            'debt':    str(profile.current_debt),
            'daily':   str(totals['daily']),
            'weekly':  str(totals['weekly']),
            'monthly': str(totals['monthly']),
        })


class PayCommissionView(APIView):
    """
    POST /api/v1/driver/pay-commission/
    Body: { amount, method, reference, screenshot?, note? }
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        amount    = request.data.get('amount')
        method    = request.data.get('method', '').upper()
        reference = request.data.get('reference', '').strip()

        if not amount:
            return Response({'error': 'Amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if method not in ('TELEBIRR', 'CBE'):
            return Response({'error': 'Method must be TELEBIRR or CBE.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reference:
            return Response({'error': 'Reference number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'error': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        # select_for_update prevents two concurrent requests both passing
        # the PENDING check before either creates the record
        with transaction.atomic():
            if CommissionPayment.objects.select_for_update().filter(driver=profile, status='PENDING').exists():
                return Response(
                    {'error': 'You already have a payment under review. Cancel it first to submit a new one.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payment = CommissionPayment.objects.create(
                driver=profile,
                amount=amount,
                method=method,
                reference=reference,
                screenshot=request.data.get('screenshot', '') or None,
                note=request.data.get('note', ''),
            )

        return Response({
            'message':    'Payment submitted, under review.',
            'payment_id': payment.id,
        }, status=status.HTTP_201_CREATED)


class CommissionPaymentHistoryView(APIView):
    """
    GET /api/v1/driver/commission-payments/
    Returns the driver's payment history.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        payments = profile.commission_payments.all().order_by('-created_at')
        data = [{
            'id':         p.id,
            'amount':     str(p.amount),
            'method':     p.method,
            'reference':  p.reference,
            'screenshot': p.screenshot,
            'status':     p.status,
            'admin_note': p.admin_note,
            'created_at': p.created_at.isoformat(),
        } for p in payments]

        return Response({'payments': data})


class CancelCommissionPaymentView(APIView):
    """
    POST /api/v1/driver/cancel-commission-payment/
    Cancels the driver's PENDING commission payment so they can resubmit.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        pending = CommissionPayment.objects.filter(driver=profile, status='PENDING').first()
        if not pending:
            return Response({'error': 'No pending payment to cancel.'}, status=status.HTTP_404_NOT_FOUND)

        pending.status = 'CANCELLED'
        pending.save(update_fields=['status'])

        return Response({'message': 'Pending payment cancelled. You can now submit a new one.'})
