from django.db import transaction, IntegrityError
from customers.models import Task, TaskAssignment, AdminAction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@transaction.atomic
def manual_assign(task, driver_profile, admin):
    try:
        task = Task.objects.select_for_update().get(id=task.id)

        if task.status != 'PENDING':
            return {
                'success': False,
                'message': f'Task is already {task.status}'
            }

        if not driver_profile.is_verified:
            return {
                'success': False,
                'message': 'Driver must be verified to be assigned'
            }

        # Check if this driver already has a pending offer for this task
        if TaskAssignment.objects.filter(task=task, driver=driver_profile, outcome='PENDING').exists():
            return {
                'success': False,
                'message': f'Driver {driver_profile.id} already has a pending offer for this task'
            }

        # Cancel any existing PENDING assignments to other drivers
        TaskAssignment.objects.filter(
            task=task,
            outcome='PENDING'
        ).update(outcome='LOST', responded_at=timezone.now())

        # Create a PENDING assignment — driver still needs to accept/reject
        TaskAssignment.objects.create(
            task=task,
            driver=driver_profile,
            outcome='PENDING',
        )

        # Log admin action
        AdminAction.objects.create(
            admin=admin,
            task=task,
            driver=driver_profile,
            action_type='MANUAL_ASSIGN',
            note=f'Admin manually offered task {task.id} to driver {driver_profile.id}'
        )

        logger.info(f"Task {task.id} manually offered to driver {driver_profile.id} by admin {admin.id}")

        # TODO: [NOTIF] notify driver — MANUAL_ASSIGNMENT_OFFER
        # TODO: [FCM] push to driver to accept/reject

        return {
            'success': True,
            'message': f'Task {task.id} offered to driver {driver_profile.id}, awaiting response'
        }

    except IntegrityError:
        return {
            'success': False,
            'message': f'Driver {driver_profile.id} is already assigned to this task'
        }
    except Exception as e:
        logger.error(f"Error manually assigning task {task.id}: {e}")
        return {
            'success': False,
            'message': f'Manual assign failed: {str(e)}'
        }
