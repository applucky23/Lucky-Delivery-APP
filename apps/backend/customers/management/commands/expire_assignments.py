from django.core.management.base import BaseCommand
from tasks.services.assignment_expiry import expire_stale_assignments, auto_cancel_exhausted_tasks, auto_offline_idle_drivers


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
