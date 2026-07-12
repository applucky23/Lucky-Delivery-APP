from django.utils import timezone
from .cancel_task import cancel
from .task_completion import complete_task
from customers.models import Task
from notifications.services import create_notification
import logging

logger = logging.getLogger(__name__)



def start_delivery(task, driver_profile):
    """Driver starts delivery — for DELIVERY and ERRAND this auto-completes (no 'delivering' state)"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    valid_sources = {'DELIVERY': ['ARRIVED'], 'SHOPPING': ['PURCHASED'], 'ERRAND': ['ARRIVED']}
    allowed = valid_sources.get(task.type, ['ARRIVED'])
    if task.status not in allowed:
        raise ValueError(
            f"Cannot start delivery from status {task.status} for {task.type} tasks"
        )

    if task.type in ('ERRAND', 'DELIVERY'):
        # ERRAND: end waiting timer (DELIVERY never starts it)
        if task.type == 'ERRAND':
            task.waiting_ended_at = timezone.now()
        # ERRAND and DELIVERY skip DELIVERING — complete immediately
        task.start_delivery()
        task.save()
        complete_task(task, driver_profile)
        return

    task.start_delivery()  # FSM transition
    task.save()

    create_notification(
        task.user, 'TASK_COMPLETED',
        'Delivery started',
        f'Your driver is on the way with your {task.get_type_display().lower()} order.',
    )


def done_shopping(task, driver_profile):
    """Driver finishes shopping (SHOPPING only) — ends waiting timer, transitions PURCHASED → DELIVERING"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    if task.type != 'SHOPPING':
        raise ValueError("Only shopping tasks support this action")

    if task.status != 'PURCHASED':
        raise ValueError(f"Cannot finish shopping from status {task.status}")

    # End waiting timer
    task.waiting_ended_at = timezone.now()
    task.start_delivery()  # PURCHASED → DELIVERING
    task.save()

    logger.info(f"Task {task.id}: driver {driver_profile.id} finished shopping")

    create_notification(
        task.user, 'TASK_COMPLETED',
        'Delivery started',
        f'Your driver is on the way with your {task.get_type_display().lower()} order.',
    )


def arrive_at_dropoff(task, driver_profile):
    """Driver arrives at the errand dropoff location (errands with pickup only)"""

    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    if task.type != 'ERRAND':
        raise ValueError("Only errand tasks support this action")

    if task.status != 'ARRIVED':
        raise ValueError(f"Cannot arrive at dropoff from status {task.status}")

    if (task.estimated_distance_km or 0) < 0.01:
        raise ValueError("Task has no pickup location")

    task.arrived_at_dropoff_at = timezone.now()
    task.waiting_started_at = timezone.now()
    task.save()

    logger.info(f"Task {task.id}: driver {driver_profile.id} arrived at errand dropoff")

    create_notification(
        task.user, 'DRIVER_ARRIVED',
        'Driver at errand location',
        f'Your driver has arrived at the errand location for task #{task.id}.',
    )


def submit_item_amount(task, driver_profile, reported_amount):
    """Driver submits the item cost for purchase (SHOPPING only)"""

    if task.type != 'SHOPPING':
        raise ValueError("Only shopping tasks require price submission")

    task.item_cost = reported_amount
    task.approve_purchase()  # ARRIVED → PURCHASED directly, no customer approval needed
    task.save()

    create_notification(
        task.user, 'TASK_ASSIGNED',
        'Items purchased',
        f'Driver has purchased your items (cost: {reported_amount} ETB). Review in task details.',
    )