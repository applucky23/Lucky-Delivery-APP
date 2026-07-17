from django.utils import timezone
from django.db import transaction
from customers.models import Task, TaskAssignment
from .matching import find_best_drivers_for_task
from notifications.services.notify_service import notify_task_offer
import logging

logger = logging.getLogger(__name__)


@transaction.atomic
def dispatch(task):
    try:
        # Find the best drivers for this task
        best_drivers = find_best_drivers_for_task(
            task, 
            max_distance_km=10, 
            limit=5
        )
        
        if not best_drivers:
            logger.warning(f"No drivers found for task {task.id}")
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
            notify_task_offer(best_drivers, task)
        else:
            logger.warning(f"Task {task.id}: all assignments already exist (duplicates)")
        
        return {
            'success': True,
            'message': f'Task dispatched to {count} drivers',
            'drivers_notified': count,
            'assignment_ids': [assignment.id for assignment in created_assignments]
        }
        
    except Exception as e:
        logger.error(f"Error dispatching task {task.id}: {e}")
        return {
            'success': False,
            'message': f'Dispatch failed: {str(e)}',
            'drivers_notified': 0
        }
