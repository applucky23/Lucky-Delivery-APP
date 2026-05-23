from geopy.distance import geodesic
from django.utils import timezone
from customers.models import DriverLocation

MAX_ARRIVAL_DISTANCE_METERS = 300

def validate_driver_at_pickup(driver_profile, task, driver_location=None):
    """Check if driver is within 300m of task pickup location"""
    if driver_location is None:
        try:
            driver_location = driver_profile.location
        except DriverLocation.DoesNotExist:
            raise ValueError("Driver location not found")

    driver_coords = (float(driver_location.latitude), float(driver_location.longitude))
    pickup_coords = (float(task.pickup_lat), float(task.pickup_lng))

    distance = geodesic(driver_coords, pickup_coords).meters

    if distance > MAX_ARRIVAL_DISTANCE_METERS:
        raise ValueError(
            f"You are {int(distance)}m away from the pickup location. "
            f"You must be within {MAX_ARRIVAL_DISTANCE_METERS}m to mark arrival."
        )



def mark_task_arrived(task, driver_profile):
    """Mark task as arrived and start waiting timer"""

    task.mark_arrived()  # FSM transition, also sets arrived_at_location_at via the model

    # Start waiting timer for shopping/errand only
    if task.type in ['SHOPPING', 'ERRAND']:
        task.waiting_started_at = timezone.now()
        task.save(update_fields=['status', 'arrived_at_location_at', 'waiting_started_at'])
    else:
        task.save(update_fields=['status', 'arrived_at_location_at'])

    # TODO: notify customer that driver has arrived
