from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from customers.models import Task, TaskAssignment
from .matching import find_best_drivers_for_task
from notifications.services import create_notification
import logging

logger = logging.getLogger(__name__)

MAX_DISPATCH_ATTEMPTS = 3
EXHAUSTED_WINDOW_MINUTES = 30


@transaction.atomic
def dispatch(task):
    # Reload task for latest state
    task = Task.objects.select_for_update().get(id=task.id)

    # ── Exhausted check: past deadline → refuse ──────────────────────
    if task.auto_dispatch_exhausted and task.auto_cancel_at:
        if timezone.now() >= task.auto_cancel_at:
            logger.warning(f"Task {task.id} past auto-cancel deadline, not dispatching")
            return {
                'success': False,
                'message': 'Dispatch window expired',
                'drivers_notified': 0,
            }

    # ── Increment attempt counter (skip if already exhausted) ────────
    if not task.auto_dispatch_exhausted:
        task.dispatch_attempts += 1
        if task.dispatch_attempts >= MAX_DISPATCH_ATTEMPTS:
            task.auto_dispatch_exhausted = True
            task.auto_cancel_at = timezone.now() + timedelta(minutes=EXHAUSTED_WINDOW_MINUTES)
            logger.warning(
                f"Task {task.id} exhausted after {task.dispatch_attempts} attempts, "
                f"auto-cancel at {task.auto_cancel_at}"
            )
        task.save(update_fields=[
            'dispatch_attempts', 'auto_dispatch_exhausted', 'auto_cancel_at'
        ])

    try:
        # Find the best drivers for this task
        best_drivers = find_best_drivers_for_task(
            task, 
            max_distance_km=10, 
            limit=5
        )
        
        if not best_drivers:
            logger.warning(f"No drivers found for task {task.id} (attempt {task.dispatch_attempts})")
            # Notification suppressed until auto-cancel after 30-min exhaust window
            return {
                'success': False,
                'message': 'No available drivers found',
                'drivers_notified': 0
            }
        
        # Create bulk assignments for all selected drivers
        assignments_to_create = []
        for driver in best_drivers:
            assignments_to_create.append(
                TaskAssignment(
                    task=task,
                    driver=driver,
                    outcome='PENDING'  # All start as pending
                )
            )
        
        # Bulk create assignments (ignore conflicts from race conditions)
        created_assignments = TaskAssignment.objects.bulk_create(
            assignments_to_create,
            batch_size=5,
            ignore_conflicts=True
        )
        
        count = len(created_assignments)
        if count:
            logger.info(f"Task {task.id} dispatched to {count} drivers")
        else:
            logger.warning(f"Task {task.id}: all assignments already exist (duplicates)")
        
        return {
            'success': True,
            'message': f'Task dispatched to {count} drivers',
            'drivers_notified': count,
        }
        
    except Exception as e:
        logger.error(f"Error dispatching task {task.id}: {e}")
        return {
            'success': False,
            'message': f'Dispatch failed: {str(e)}',
            'drivers_notified': 0
        }
