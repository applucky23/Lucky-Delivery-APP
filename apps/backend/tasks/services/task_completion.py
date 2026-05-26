from decimal import Decimal
from django.db import transaction
from customers.models import TaskTransaction, WalletTransaction
from notifications.services.notify_service import notify, notify_commission_added

COMMISSION_RATE = Decimal('0.15')
WAITING_FEE_PER_MINUTE = Decimal('1')  # 1 birr per minute
GRACE_PERIOD_MINUTES = 10              # first 10 minutes free


def calculate_waiting_fee(task):
    """1 birr per minute after the first 10 free minutes"""
    if not task.waiting_started_at or not task.waiting_ended_at:
        return Decimal('0')

    duration = task.waiting_ended_at - task.waiting_started_at
    total_minutes = int(duration.total_seconds() // 60)
    billable_minutes = max(0, total_minutes - GRACE_PERIOD_MINUTES)

    return billable_minutes * WAITING_FEE_PER_MINUTE


def calculate_final_price(task):
    """Calculate final price and commission base based on task type"""
    estimated = Decimal(str(task.estimated_price))

    # DELIVERY or ERRAND+return_trip following SHOPPING workflow
    if task.type == 'DELIVERY':
        return estimated, Decimal('0'), estimated

    # ERRAND (standard — fixed fee + waiting, no item_cost)
    if task.type == 'ERRAND' and not task.is_return_trip:
        waiting_fee = calculate_waiting_fee(task)
        final = estimated + waiting_fee
        commission_base = final  # full amount, no item_cost involved
        return final, waiting_fee, commission_base

    # SHOPPING or ERRAND+return_trip (full shopping workflow)
    waiting_fee = calculate_waiting_fee(task)
    item_cost = Decimal(str(task.item_cost)) if task.item_cost else Decimal('0')

    # TODO: add minor_adjustment_fee for map API price deviation (v2)
    final = estimated + waiting_fee + item_cost
    commission_base = estimated + waiting_fee  # item_cost excluded, driver spent that himself

    return final, waiting_fee, commission_base


def validate_completion_status(task):
    """Validate task is in correct status for completion based on type"""
    if task.type == 'ERRAND' and not task.is_return_trip:
        # Standard errand completes from PURCHASED
        if task.status != 'PURCHASED':
            raise ValueError(f"Errand task cannot be completed from status {task.status}")
    else:
        # DELIVERY and SHOPPING and ERRAND+return complete from DELIVERING
        if task.status != 'DELIVERING':
            raise ValueError(f"Task cannot be completed from status {task.status}")


@transaction.atomic
def complete_task(task, driver_profile):
    """Complete a task and handle all financial and driver state updates"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    validate_completion_status(task)

    final_price, waiting_fee, commission_base = calculate_final_price(task)
    commission = (commission_base * COMMISSION_RATE).quantize(Decimal('0.01'))

    # FSM transition — sets completed_at automatically
    task.complete_task()
    task.final_price = final_price
    task.waiting_time_fee = waiting_fee
    task.save(update_fields=['status', 'final_price', 'waiting_time_fee', 'completed_at'])

    # Update driver
    driver = driver_profile
    driver.current_debt = Decimal(str(driver.current_debt)) + commission
    driver.is_available = True
    driver.total_tasks += 1
    driver.save(update_fields=['current_debt', 'is_available', 'total_tasks'])

    # Log commission as wallet transaction
    WalletTransaction.objects.create(
        driver=driver_profile,
        task=task,
        type='COMMISSION',
        amount=commission,
        description=(
            f'Commission for Task #{task.id} — '
            f'{COMMISSION_RATE * 100}% of {commission_base} birr'
        )
    )

    # Log task completion transaction
    TaskTransaction.objects.create(
        task=task,
        actor=driver_profile.user,
        type='TASK_COMPLETED',
        amount=final_price,
        metadata={
            'estimated_price': str(task.estimated_price),
            'waiting_fee': str(waiting_fee),
            'item_cost': str(task.item_cost) if task.item_cost else '0',
            'commission_base': str(commission_base),
            'commission': str(commission),
            'task_type': task.type,
            'is_return_trip': task.is_return_trip,
        }
    )

    # TODO: prompt both driver and customer to rate each other
    notify(
        event='TASK_COMPLETED',
        user=task.customer,
        task=task,
        context={'task_type': task.get_type_display(), 'final_price': str(final_price)},
        data={'screen': 'rate_driver', 'task_id': task.id},
    )
    notify_commission_added(driver_profile, task, commission)
    notify(
        event='RATE_REMINDER',
        user=task.customer,
        task=task,
        context={'rate_message': 'How was your experience? Rate your driver.'},
        data={'screen': 'rate_driver', 'task_id': task.id},
    )
    notify(
        event='RATE_REMINDER',
        user=driver_profile.user,
        task=task,
        context={'rate_message': 'How was your experience? Rate your customer.'},
        data={'screen': 'rate_customer', 'task_id': task.id},
    )
