from django.utils import timezone
from .cancel_task import cancel
from customers.models import Task, AdminAction


def start_delivery(task, driver_profile):
    """Driver starts delivery — DELIVERY type only"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    if task.type != 'DELIVERY' and not (task.type == 'ERRAND' and task.is_return_trip):
        raise ValueError("Only delivery tasks or return-trip errands can use this endpoint")

    if task.status != 'ARRIVED':
        raise ValueError(f"Cannot start delivery from status {task.status}")

    task.start_delivery()  # FSM transition
    task.save(update_fields=['status'])

    # TODO: notify customer that driver is on the way


def submit_item_amount(task, driver_profile, reported_amount):
    """Driver submits the item cost for customer approval (SHOPPING/ERRAND only)"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    if task.type == 'DELIVERY':
        raise ValueError("Delivery tasks do not require price approval")

    task.item_cost = reported_amount
    task.request_approval()
    task.save(update_fields=['item_cost', 'status'])

    # TODO: notify customer that price approval is required


def approve_price(task, user):
    """Customer or admin approves the driver's quoted item cost"""
    is_admin = user.role == 'ADMIN'

    if not is_admin and task.user != user:
        raise ValueError("You are not the owner of this task")

    if task.status != 'AWAITING_APPROVAL':
        raise ValueError(f"Task cannot be approved from status {task.status}")

    task.waiting_ended_at = timezone.now()
    task.approve_purchase()  # FSM transition, sets is_price_confirmed = True
    task.save(update_fields=['waiting_ended_at', 'status', 'is_price_confirmed'])

    if is_admin:
        AdminAction.objects.create(
            admin=user,
            task=task,
            driver=task.driver,
            action_type='APPROVE_PRICE',
            note=f'Admin approved item cost for task {task.id}',
        )

    # TODO: notify driver that price was approved


def reject_price(task, user):
    """Customer or admin rejects the driver's quoted item cost — auto cancels task"""
    is_admin = user.role == 'ADMIN'

    if not is_admin and task.user != user:
        raise ValueError("You are not the owner of this task")

    if task.status != 'AWAITING_APPROVAL':
        raise ValueError(f"Task cannot be rejected from status {task.status}")

    # Pass the task owner so cancel()'s owner path runs correctly,
    # but if admin is rejecting, pass admin so the admin path runs instead
    cancel(task, user)

    if is_admin:
        AdminAction.objects.create(
            admin=user,
            task=task,
            driver=task.driver,
            action_type='REJECT_PRICE',
            note=f'Admin rejected item cost for task {task.id}',
        )

    # TODO: notify driver that price was rejected and prompt them to rate the user
    # TODO: future — compensation logic for driver