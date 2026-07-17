from django.db import transaction
from customers.models import Task, TaskAssignment
from .task_assignment import dispatch
from core.services.capabilities import is_driver_capable
from notifications.services.notify_service import notify, notify_task_taken
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@transaction.atomic
def accept_task(task, driver_profile):
    """
    Atomic accept — first driver to call this wins.

    Args:
        task (Task): The task to accept
        driver_profile (DriverProfile): The driver accepting the task

    Returns:
        dict: result with success flag and message
    """
    try:
        # Lock the task row — no other transaction can touch it until we're done
        task = Task.objects.select_for_update().get(id=task.id)

        # Check task is still open
        if task.status != 'PENDING':
            return {
                'success': False,
                'message': 'Task is no longer available',
                'already_taken': True
            }

        # Check this driver actually has a PENDING assignment for this task
        try:
            assignment = TaskAssignment.objects.select_for_update().get(
                task=task,
                driver=driver_profile,
                outcome='PENDING'
            )
        except TaskAssignment.DoesNotExist:
            return {
                'success': False,
                'message': 'No pending assignment found for this driver',
                'already_taken': False
            }

        # Re-validate driver's vehicle at accept time
        # Driver may have changed vehicle type after the initial dispatch
        if driver_profile.vehicle_type != task.vehicle_type:
            return {
                'success': False,
                'message': f'Your vehicle type ({driver_profile.vehicle_type}) no longer matches what this task requires ({task.vehicle_type})'
            }

        if task.estimated_distance_km:
            if not is_driver_capable(driver_profile, float(task.estimated_distance_km)):
                return {
                    'success': False,
                    'message': f'Your vehicle cannot handle this trip distance ({task.estimated_distance_km}km)'
                }

        # This driver wins — advance FSM and assign
        task.driver = driver_profile
        task.assign_driver()
        task.save(update_fields=['driver', 'status'])

        # Set driver as unavailable while working on this task
        driver_profile.is_available = False
        driver_profile.save(update_fields=['is_available'])

        # Mark this assignment as accepted
        assignment.outcome = 'ACCEPTED'
        assignment.responded_at = timezone.now()
        assignment.save()

        # Mark all other PENDING assignments for this task as LOST
        TaskAssignment.objects.filter(
            task=task,
            outcome='PENDING'
        ).exclude(id=assignment.id).update(
            outcome='LOST',
            responded_at=timezone.now()
        )

        logger.info(f"Task {task.id} accepted by driver {driver_profile.id}")

        # Notify winning driver
        notify(
            event='ASSIGNMENT_CONFIRMED',
            user=driver_profile.user,
            task=task,
            context={'task_type': task.get_type_display()},
            data={'screen': 'active_task', 'task_id': task.id},
        )
        # Notify losing drivers
        losing_profiles = [
            a.driver for a in TaskAssignment.objects.filter(
                task=task, outcome='LOST'
            ).select_related('driver')
        ]
        if losing_profiles:
            notify_task_taken(losing_profiles, task)
        # Notify customer
        notify(
            event='TASK_ASSIGNED',
            user=task.customer,
            task=task,
            context={'driver_name': driver_profile.user.get_full_name() or driver_profile.user.username},
            data={'screen': 'active_task', 'task_id': task.id},
        )

        return {
            'success': True,
            'message': 'Task successfully accepted',
            'task_id': task.id,
            'assignment_id': assignment.id
        }

    except Exception as e:
        logger.error(f"Error accepting task {task.id} by driver {driver_profile.id}: {e}")
        return {
            'success': False,
            'message': f'Accept failed: {str(e)}'
        }


@transaction.atomic
def reject_task(task, driver_profile):
    """
    Driver opts out of a task.
    If all drivers have rejected, re-dispatch or mark as failed.

    Args:
        task (Task): The task to reject
        driver_profile (DriverProfile): The driver rejecting the task

    Returns:
        dict: result with success flag and message
    """
    try:
        # Mark this driver's assignment as rejected
        assignment = TaskAssignment.objects.select_for_update().get(
            task=task,
            driver=driver_profile,
            outcome='PENDING'
        )

        assignment.outcome = 'REJECTED'
        assignment.responded_at = timezone.now()
        assignment.save()

        logger.info(f"Task {task.id} rejected by driver {driver_profile.id}")

        # Check if all assignments are done (no more PENDING)
        has_pending = TaskAssignment.objects.filter(
            task=task,
            outcome='PENDING'
        ).exists()

        if not has_pending:
            # All drivers rejected — re-dispatch
            logger.warning(f"All drivers rejected task {task.id}, re-dispatching...")
            redispatch_result = dispatch(task)

            if not redispatch_result['success']:
                # No drivers found at all
                logger.error(f"Re-dispatch failed for task {task.id}")
                notify(
                    event='NO_DRIVERS_FOUND',
                    user=task.user,
                    task=task,
                    context={'task_type': task.get_type_display()},
                    data={'screen': 'home', 'task_id': task.id},
                )

        return {
            'success': True,
            'message': 'Task rejected successfully'
        }

    except TaskAssignment.DoesNotExist:
        return {
            'success': False,
            'message': 'No pending assignment found for this driver'
        }
    except Exception as e:
        logger.error(f"Error rejecting task {task.id} by driver {driver_profile.id}: {e}")
        return {
            'success': False,
            'message': f'Reject failed: {str(e)}'
        }
