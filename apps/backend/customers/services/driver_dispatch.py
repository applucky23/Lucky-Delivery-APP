from math import radians, cos, sin, asin, sqrt
from customers.models import DriverLocation, Task
from tasks.services.task_assignment import dispatch
import logging

logger = logging.getLogger(__name__)

REDISPATCH_MAX_DISTANCE_KM = 10
REDISPATCH_MAX_TASKS = 5


def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points on Earth.
    Returns distance in kilometers.
    """
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return c * 6371


def redispatch_nearby_tasks(driver_profile, location=None):
    """
    Re-dispatch PENDING tasks within REDISPATCH_MAX_DISTANCE_KM of the driver.
    
    Args:
        driver_profile: The DriverProfile instance
        location: Optional DriverLocation instance. If not provided, will fetch from driver_profile.location
    
    Returns:
        int: Number of tasks re-dispatched
    """
    if location is None:
        try:
            location = driver_profile.location
        except DriverLocation.DoesNotExist:
            logger.info(f"Driver {driver_profile.id} has no location, skipping re-dispatch")
            return 0

    pending_tasks = Task.objects.filter(
        status='PENDING',
    )[:REDISPATCH_MAX_TASKS]

    dispatched_count = 0
    for task in pending_tasks:
        try:
            dist = haversine(
                float(task.pickup_lat), float(task.pickup_lng),
                float(location.latitude), float(location.longitude)
            )
            if dist <= REDISPATCH_MAX_DISTANCE_KM:
                result = dispatch(task)
                if result['success']:
                    dispatched_count += 1
                    logger.info(f"Re-dispatched task {task.id} to {result['drivers_notified']} drivers")
        except (ValueError, TypeError) as e:
            logger.warning(f"Error calculating distance for task {task.id}: {e}")
            continue

    return dispatched_count
