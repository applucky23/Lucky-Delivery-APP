from customers.models import Task
from django.core.exceptions import ValidationError


def validate_user_can_create_task(user):
    """Validate if user can create a new task"""
    if not user.is_active:
        raise ValidationError("Inactive users cannot create tasks.")
    
    if user.role == 'DRIVER':
        raise ValidationError("Drivers are not allowed to create tasks.")
    
    existing_tasks = Task.objects.filter(user=user).exclude(
        status__in=['COMPLETED', 'CANCELLED']
    ).exists()
    
    if existing_tasks:
        raise ValidationError("You already have an active task.")
    
    return True


def validate_task_can_be_updated(task):
    """Validate if task can be updated"""
    if task.status in ['COMPLETED', 'CANCELLED']:
        raise ValidationError("Cannot update a completed or cancelled task.")
    
    if task.status not in ['PENDING', 'ASSIGNED']:
        raise ValidationError("This task can no longer be updated.")
    
    return True
