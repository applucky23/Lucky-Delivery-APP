from geopy.distance import geodesic
from django.utils import timezone
from customers.models import DriverLocation
from notifications.services.notify_service import notify

MAX_ARRIVAL_DISTANCE_METERS = 300

def check_arrival_distance(driver_profile, task, driver_location=None):
    """Returns distance in meters from driver to pickup, or None if location unknown."""
    if driver_location is None:
        try:
            driver_location = driver_profile.location
        except DriverLocation.DoesNotExist:
            return None

    driver_coords = (float(driver_location.latitude), float(driver_location.longitude))
    pickup_coords = (float(task.pickup_lat), float(task.pickup_lng))

    return int(geodesic(driver_coords, pickup_coords).meters)


def mark_task_arrived(task, driver_profile):
    """Mark task as arrived and start waiting timer"""

    task.mark_arrived()  # FSM transition, also sets arrived_at_location_at via the model

    # Start waiting timer for shopping or errands without pickup
    # Errands with pickup start waiting when driver arrives at dropoff
    if task.type == 'SHOPPING':
        task.waiting_started_at = timezone.now()
    elif task.type == 'ERRAND' and (task.estimated_distance_km or 0) < 0.01:
        task.waiting_started_at = timezone.now()
        task.save(update_fields=['status', 'arrived_at_location_at', 'waiting_started_at'])
    else:
        task.save(update_fields=['status', 'arrived_at_location_at'])

    notify(
        event='DRIVER_ARRIVED',
        user=task.customer,
        task=task,
        data={'screen': 'active_task', 'task_id': task.id},
    )
