from django.db import transaction
from customers.models import TaskTransaction

# TODO: Trigger notification (TASK_CANCELLED) via notifications app
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
        task.save()

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
        return
    # owner rule - can only cancel pending tasks
    if task.status not in ['PENDING', 'ASSIGNED']:
        raise ValueError("Only pending or assigned tasks can be cancelled")
    previous_status = task.status

    task.cancel_task()
    task.save()
    
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
