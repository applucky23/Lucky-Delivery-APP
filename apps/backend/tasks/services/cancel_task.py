from django.db import transaction
from customers.models import TaskTransaction,AdminAction,TaskAssignment
from notifications.services.notify_service import notify

@transaction.atomic
def cancel(task,user):
    """Cancel a task using FSM transition"""
    # already finished safety check
    if task.status in ['COMPLETED', 'CANCELLED']:
        raise ValueError("Cannot cancel this task")
    # admin override - can cancel any task
    if user.role == 'ADMIN':
        previous_status = task.status
        task.cancel_task()
        task.save(update_fields=['status'])

        if task.driver:
            task.driver.is_available = True
            task.driver.save(update_fields=["is_available"])

        # Make any pending assignment Lost
        TaskAssignment.objects.filter(
            task=task,
            outcome='PENDING'
        ).update(outcome='LOST')

        # Create transaction record for admin override
        TaskTransaction.objects.create(
            task=task,
            actor=user,
            type='ADMIN_OVERRIDE',
            metadata={
                'previous_status': previous_status,
                'cancelled_by': 'admin',
                'reason': 'Admin cancelled task'
            }
        )
        AdminAction.objects.create(
            admin=user,
            task=task,
            driver=task.driver,
            action_type='CANCEL_TASK',
            note=f'Admin cancelled task {task.id}',
        )
        notify(
            event='TASK_CANCELLED',
            user=task.user,
            task=task,
            context={'task_type': task.get_type_display()},
            data={'screen': 'home', 'task_id': task.id},
        )
        if task.driver:
            notify(
                event='TASK_CANCELLED',
                user=task.driver.user,
                task=task,
                context={'task_type': task.get_type_display()},
                data={'screen': 'home', 'task_id': task.id},
            )
        return
    # owner rule - can only cancel pending tasks
    if task.status not in ['PENDING', 'ASSIGNED','AWAITING_APPROVAL']:
        raise ValueError("Only pending,assigned or awaiting approval tasks can be cancelled")
    previous_status = task.status

    task.cancel_task()
    task.save(update_fields=['status'])
    if task.driver:
        task.driver.is_available = True
        task.driver.save(update_fields=["is_available"])

    # Make any pending assignment Lost
    TaskAssignment.objects.filter(
        task=task,
        outcome='PENDING'
    ).update(outcome='LOST')

    # Create transaction record for user cancellation
    TaskTransaction.objects.create(
        task=task,
        actor=user,
        type='TASK_CANCELLED',
        metadata={
            'previous_status': previous_status,
            'cancelled_by': 'owner',
            'reason': 'User cancelled their own task'
        }
    )
    notify(
        event='TASK_CANCELLED',
        user=task.user,
        task=task,
        context={'task_type': task.get_type_display()},
        data={'screen': 'home', 'task_id': task.id},
    )
    if task.driver:
        notify(
            event='TASK_CANCELLED',
            user=task.driver.user,
            task=task,
            context={'task_type': task.get_type_display()},
            data={'screen': 'home', 'task_id': task.id},
        )
