from django.core.management.base import BaseCommand
from tasks.services.assignment_expiry import expire_stale_assignments, auto_cancel_exhausted_tasks, auto_offline_idle_drivers

# TODO: Convert to Celery Beat periodic task for production
# Recommended approach: Use Celery Beat instead of cron jobs for:
# - Better reliability and error handling
# - Automatic retries on failure
# - Works in distributed environments
# - No external cron setup needed
# 
# Example Celery Beat setup:
# @app.on_after_configure.connect
# def setup_periodic_tasks(sender, **kwargs):
#     sender.add_periodic_task(30.0, expire_stale_assignments.s(), name='expire-stale-assignments-every-30s')
#     sender.add_periodic_task(300.0, auto_cancel_exhausted_tasks.s(), name='auto-cancel-exhausted-every-5min')
#     sender.add_periodic_task(300.0, auto_offline_idle_drivers.s(), name='auto-offline-idle-drivers-every-5min')
#
# For now, use cron: run every 30 seconds
# */1 * * * * cd /path/to/backend && python manage.py expire_assignments


class Command(BaseCommand):
    help = 'Expire stale assignments, auto-cancel exhausted tasks, and auto-offline idle drivers'

    def handle(self, *args, **options):
        expired = expire_stale_assignments()
        if expired:
            self.stdout.write(self.style.SUCCESS(f'Expired {expired} stale assignment(s)'))
        else:
            self.stdout.write('No stale assignments to expire')

        cancelled = auto_cancel_exhausted_tasks()
        if cancelled:
            self.stdout.write(self.style.SUCCESS(f'Auto-cancelled {cancelled} exhausted task(s)'))
        else:
            self.stdout.write('No exhausted tasks to auto-cancel')

        offlined = auto_offline_idle_drivers()
        if offlined:
            self.stdout.write(self.style.SUCCESS(f'Auto-offlined {offlined} idle driver(s)'))
        else:
            self.stdout.write('No idle drivers to offline')
