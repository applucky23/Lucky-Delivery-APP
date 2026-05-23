from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from customers.models import TaskAssignment
from tasks.services.task_assignment import dispatch
import logging

logger = logging.getLogger(__name__)

ASSIGNMENT_TIMEOUT_MINUTES = 3

#TODO: This will be converted to a celery function later!!
class Command(BaseCommand):
    help = 'Expire pending task assignments that have timed out and re-dispatch if needed'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(minutes=ASSIGNMENT_TIMEOUT_MINUTES)

        # Find all tasks that have timed-out PENDING assignments
        timed_out = TaskAssignment.objects.filter(
            outcome='PENDING',
            notified_at__lt=cutoff,
        ).select_related('task')

        if not timed_out.exists():
            logger.info('No timed-out assignments found')
            return

        # Group by task so we handle each task once
        tasks_to_redispatch = {}
        for assignment in timed_out:
            tasks_to_redispatch[assignment.task_id] = assignment.task

        # Expire all timed-out PENDING assignments in one query
        timed_out_ids = list(timed_out.values_list('id', flat=True))
        TaskAssignment.objects.filter(id__in=timed_out_ids).update(
            outcome='EXPIRED',
            responded_at=timezone.now(),
        )

        logger.info(f'Expired {len(timed_out_ids)} assignments across {len(tasks_to_redispatch)} tasks')

        # Re-dispatch each affected task if it's still PENDING
        for task in tasks_to_redispatch.values():
            # Refresh from DB to get current status
            task.refresh_from_db()

            if task.status != 'PENDING':
                logger.info(f'Task {task.id} is already {task.status}, skipping re-dispatch')
                continue

            # Check if there are still other PENDING assignments (another batch not yet expired)
            has_pending = TaskAssignment.objects.filter(
                task=task,
                outcome='PENDING',
            ).exists()

            if has_pending:
                logger.info(f'Task {task.id} still has active pending assignments, skipping re-dispatch')
                continue

            with transaction.atomic():
                result = dispatch(task)
                if result['success']:
                    logger.info(f'Task {task.id} re-dispatched to {result["drivers_notified"]} drivers after timeout')
                else:
                    logger.warning(f'Task {task.id} re-dispatch failed after timeout: {result["message"]}')
                    # TODO: notify user that no drivers are available
