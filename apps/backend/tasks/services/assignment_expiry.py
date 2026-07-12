from django.utils import timezone
from datetime import timedelta
from django.db.models import Q, Max
from customers.models import TaskAssignment, Task, TaskTransaction, DriverProfile
from notifications.services import create_notification
import logging

logger = logging.getLogger(__name__)

ASSIGNMENT_TTL_SECONDS = 60
EXHAUSTED_AUTO_CANCEL_AFTER_MINUTES = 30
GPS_STALE_AFTER_MINUTES = 5


def expire_stale_assignments(task_id=None):
    """
    Expire PENDING TaskAssignments older than TTL.
    Optionally filter to a specific task. Re-dispatches affected tasks
    (or the given task) if still PENDING.

    Args:
        task_id (int, optional): If set, only expire assignments for this task.

    Returns:
        int: Number of assignments expired
    """
    cutoff = timezone.now() - timedelta(seconds=ASSIGNMENT_TTL_SECONDS)
    qs = TaskAssignment.objects.filter(
        outcome='PENDING',
        notified_at__lt=cutoff
    )
    if task_id is not None:
        qs = qs.filter(task_id=task_id)

    task_ids = list(qs.values_list('task_id', flat=True).distinct())
    count = qs.count()

    if not count:
        return 0

    qs.update(
        outcome='EXPIRED',
        responded_at=timezone.now()
    )
    logger.info(f"Expired {count} stale assignments across {len(task_ids)} tasks")

    # Re-dispatch each affected task if still PENDING
    from .task_assignment import dispatch
    affected_tasks = Task.objects.filter(id__in=task_ids, status='PENDING')
    for task in affected_tasks:
        logger.info(f"Re-dispatching task {task.id} after expiry")
        dispatch(task)

    return count


def auto_cancel_exhausted_tasks():
    """
    Cancel tasks that have been auto-dispatch exhausted past the deadline.
    Returns number of tasks cancelled.
    """
    now = timezone.now()
    candidates = Task.objects.filter(
        status='PENDING',
        auto_dispatch_exhausted=True,
        auto_cancel_at__lt=now,
    )

    count = 0
    for task in candidates:
        logger.warning(f"Auto-cancelling exhausted task {task.id} (exhausted since {task.auto_cancel_at})")

        # Mark assignments as LOST
        TaskAssignment.objects.filter(
            task=task,
            outcome='PENDING'
        ).update(outcome='LOST')

        # FSM transition
        task.cancel_task()
        task.save()

        # Create transaction record
        TaskTransaction.objects.create(
            task=task,
            actor=None,
            type='TASK_CANCELLED',
            metadata={
                'previous_status': 'PENDING',
                'cancelled_by': 'system',
                'reason': 'Auto-cancelled: no available drivers',
            }
        )

        create_notification(
            task.user, 'SYSTEM_ALERT',
            'Task cancelled',
            'Your task was cancelled because no drivers were available.',
        )

        count += 1

    if count:
        logger.info(f"Auto-cancelled {count} exhausted task(s)")

    return count


def auto_offline_idle_drivers():
    """
    Mark drivers offline if their GPS hasn't updated in GPS_STALE_AFTER_MINUTES.
    Skips drivers with in-progress tasks. Returns number of drivers marked offline.
    """
    cutoff = timezone.now() - timedelta(minutes=GPS_STALE_AFTER_MINUTES)

    active_statuses = ['ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING', 'AWAITING_PAYMENT']

    idle = DriverProfile.objects.filter(
        is_online=True,
    ).annotate(
        last_gps=Max('location__updated_at')
    ).filter(
        Q(last_gps__isnull=True) | Q(last_gps__lt=cutoff)
    ).exclude(
        tasks__status__in=active_statuses
    )

    count = idle.update(is_online=False, is_available=False)
    if count:
        logger.info(f"Auto-offlined {count} idle driver(s)")
    return count
