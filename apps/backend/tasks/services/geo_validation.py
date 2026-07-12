from geopy.distance import geodesic
from django.utils import timezone
from customers.models import DriverLocation

def check_arrival_distance(driver_profile, task):
    """Returns distance in meters from driver to pickup, or None if location unknown."""
    try:
        location = driver_profile.location
    except DriverLocation.DoesNotExist:
        return None

    driver_coords = (float(location.latitude), float(location.longitude))
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

    task.save()

    # TODO: notify customer that driver has arrived
