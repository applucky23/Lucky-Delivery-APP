from customers.models import Task, DriverProfile


def get_task_or_404(task_id, select_related=None):
    qs = Task.objects.all()
    if select_related:
        qs = qs.select_related(*select_related)
    try:
        return qs.get(id=task_id)
    except Task.DoesNotExist:
        raise Task.DoesNotExist('Task not found')


def get_driver_profile_or_404(user):
    try:
        return user.driver_profile
    except DriverProfile.DoesNotExist:
        raise DriverProfile.DoesNotExist('Driver profile not found')
