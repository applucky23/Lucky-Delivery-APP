import json
import datetime
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import (
    Count, Sum, Q, F, Value, Case, When, FloatField, DecimalField, ExpressionWrapper,
)
from django.db.models.functions import ExtractHour, TruncDate, Coalesce
from django.utils import timezone
from datetime import timedelta
from .models import Task, WalletTransaction, DriverProfile, User


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if hasattr(o, 'quantize'):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


@staff_member_required
def analytics_dashboard(request):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    # ── Helper: task querysets ────────────────────────────────────────────
    completed_tasks = Task.objects.filter(status='COMPLETED')
    cancelled_tasks = Task.objects.filter(status='CANCELLED')
    all_tasks = Task.objects.all()

    completed_today = completed_tasks.filter(completed_at__gte=today_start)
    completed_week = completed_tasks.filter(completed_at__gte=week_start)
    completed_month = completed_tasks.filter(completed_at__gte=month_start)

    # ── Revenue Section (driver earnings = final_price - item_cost) ──────
    _DEC = DecimalField(max_digits=10, decimal_places=2)

    _DRIVER_EARNING = Case(
        When(type='SHOPPING',
             then=ExpressionWrapper(
                 F('final_price') - Coalesce(F('item_cost'), Value(0, output_field=_DEC)),
                 output_field=_DEC,
             )),
        default='final_price',
        output_field=_DEC,
    )

    def _sum_driver_earnings(qs):
        """Sum of driver earnings = delivery fee + waiting fee (excludes item_cost)"""
        return qs.aggregate(s=Sum(_DRIVER_EARNING))['s'] or 0

    rev_today = _sum_driver_earnings(completed_today)
    rev_week = _sum_driver_earnings(completed_week)
    rev_month = _sum_driver_earnings(completed_month)
    rev_lifetime = _sum_driver_earnings(completed_tasks)

    commission_qs = WalletTransaction.objects.filter(type='COMMISSION')
    commission_today = commission_qs.filter(created_at__gte=today_start).aggregate(s=Sum('amount'))['s'] or 0
    commission_week = commission_qs.filter(created_at__gte=week_start).aggregate(s=Sum('amount'))['s'] or 0
    commission_month = commission_qs.filter(created_at__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0
    commission_lifetime = commission_qs.aggregate(s=Sum('amount'))['s'] or 0

    # Driver earnings by task type
    rev_by_type = list(
        completed_tasks.values('type')
        .annotate(total=Sum(_DRIVER_EARNING))
        .order_by('type')
    )

    total_tasks_completed = completed_tasks.count()
    avg_task_value = round(rev_lifetime / total_tasks_completed, 2) if total_tasks_completed else 0

    waiting_fee_total = completed_tasks.aggregate(s=Sum('waiting_time_fee'))['s'] or 0
    waiting_fee_pct = round(waiting_fee_total / rev_lifetime * 100, 1) if rev_lifetime > 0 else 0

    # ── Tasks Section ─────────────────────────────────────────────────────
    total_tasks_today = all_tasks.filter(created_at__gte=today_start).count()
    total_tasks_week = all_tasks.filter(created_at__gte=week_start).count()
    total_tasks_month = all_tasks.filter(created_at__gte=month_start).count()
    total_tasks_lifetime = all_tasks.count()

    status_breakdown = list(
        all_tasks.values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    )

    completed_count = completed_tasks.count()
    cancelled_count = cancelled_tasks.count()
    completion_rate = round(completed_count / total_tasks_lifetime * 100, 1) if total_tasks_lifetime else 0

    # Cancellation rate by type
    cancel_rate_by_type = list(
        all_tasks.values('type')
        .annotate(
            total=Count('id'),
            cancelled=Count('id', filter=Q(status='CANCELLED')),
        )
        .annotate(rate=ExpressionWrapper(
            Count('id', filter=Q(status='CANCELLED')) * 100.0 / Count('id'),
            output_field=FloatField()
        ))
        .order_by('type')
    )
    for item in cancel_rate_by_type:
        item['rate'] = round(item['rate'], 1)

    # Peak hours (last 30 days)
    peak_hours = list(
        all_tasks.filter(created_at__gte=month_start)
        .annotate(hour=ExtractHour('created_at'))
        .values('hour')
        .annotate(count=Count('id'))
        .order_by('hour')
    )

    # Tasks per day (last 30 days)
    tasks_per_day = list(
        all_tasks.filter(created_at__gte=month_start)
        .annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    rev_per_day = list(
        completed_tasks.filter(completed_at__gte=month_start)
        .annotate(date=TruncDate('completed_at'))
        .values('date')
        .annotate(total=Sum(_DRIVER_EARNING))
        .order_by('date')
    )

    # ── Drivers Section ───────────────────────────────────────────────────
    active_drivers = DriverProfile.objects.filter(is_online=True).count()
    top_drivers = list(
        DriverProfile.objects.filter(total_tasks__gt=0)
        .select_related('user')
        .order_by('-total_tasks')[:10]
        .values('full_name', 'total_tasks', 'vehicle_type', 'balance', 'is_online')
    )

    # ── Customers Section ─────────────────────────────────────────────────
    active_customers = (
        User.objects.filter(role='USER', tasks__created_at__gte=now - timedelta(days=30))
        .distinct().count()
    )

    new_customers = (
        User.objects.filter(
            role='USER',
            tasks__isnull=False,
            created_at__gte=month_start,
        )
        .distinct().count()
    )

    repeat_customers = (
        User.objects.filter(role='USER')
        .annotate(order_count=Count('tasks'))
        .filter(order_count__gt=1)
        .count()
    )

    most_ordered_type = list(
        all_tasks.values('type')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    encoder = DecimalEncoder

    context = {
        # Revenue (driver earnings = delivery fee + waiting fee, before commission)
        'rev_today': round(rev_today, 2),
        'rev_week': round(rev_week, 2),
        'rev_month': round(rev_month, 2),
        'rev_lifetime': round(rev_lifetime, 2),
        'commission_today': round(commission_today, 2),
        'commission_week': round(commission_week, 2),
        'commission_month': round(commission_month, 2),
        'commission_lifetime': round(commission_lifetime, 2),
        'avg_task_value': avg_task_value,
        'waiting_fee_total': round(waiting_fee_total, 2),
        'waiting_fee_pct': waiting_fee_pct,
        'rev_by_type_json': json.dumps(rev_by_type, cls=encoder),

        # Tasks
        'total_tasks_today': total_tasks_today,
        'total_tasks_week': total_tasks_week,
        'total_tasks_month': total_tasks_month,
        'total_tasks_lifetime': total_tasks_lifetime,
        'completed_count': completed_count,
        'cancelled_count': cancelled_count,
        'completion_rate': completion_rate,
        'cancel_rate_by_type_json': json.dumps(cancel_rate_by_type, cls=encoder),
        'status_breakdown_json': json.dumps(status_breakdown, cls=encoder),
        'peak_hours_json': json.dumps(peak_hours, cls=encoder),
        'tasks_per_day_json': json.dumps(tasks_per_day, cls=encoder),
        'rev_per_day_json': json.dumps(rev_per_day, cls=encoder),

        # Drivers
        'active_drivers': active_drivers,
        'total_drivers': DriverProfile.objects.count(),
        'top_drivers': top_drivers,
        'top_drivers_json': json.dumps(top_drivers, cls=encoder),

        # Customers
        'active_customers': active_customers,
        'new_customers': new_customers,
        'repeat_customers': repeat_customers,
        'total_customers': User.objects.filter(role='USER').count(),
        'most_ordered_type_json': json.dumps(most_ordered_type, cls=encoder),
    }

    return render(request, 'admin/analytics_dashboard.html', context)
