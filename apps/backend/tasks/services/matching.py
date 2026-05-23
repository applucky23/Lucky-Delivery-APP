from customers.models import DriverProfile, DriverLocation, TaskAssignment
from core.services.capabilities import is_driver_capable
from math import radians, cos, sin, asin, sqrt
import logging

logger = logging.getLogger(__name__)


def haversine_distance(lat1, lon1, lat2, lon2):
    # TODO: Replace haversine Python loop with PostGIS geo queries for production scaling
    """
    Straight line distance between two points.
    Used to measure driver proximity to pickup — not trip distance.
    Trip distance comes from Mapbox at task creation.
    """
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371
    return c * r


def find_nearby_drivers(pickup_lat, pickup_lng, vehicle_type, max_distance_km=10, limit=10, excluded_driver_ids=None):
    """
    Find nearby available drivers filtered by vehicle type.

    Args:
        pickup_lat:          pickup latitude
        pickup_lng:          pickup longitude
        vehicle_type:        requested vehicle type from task
        max_distance_km:     search radius (default 10km)
        limit:               max drivers to return
        excluded_driver_ids: set of DriverProfile IDs to exclude (e.g. already rejected)

    Returns:
        list of dicts with driver, distance, location
    """
    try:
        # Pre-filter by vehicle type in DB — no point looping wrong vehicles
        drivers_with_location = DriverLocation.objects.select_related(
            'driver', 'driver__user'
        ).filter(
            driver__is_online=True,
            driver__is_available=True,
            driver__is_blocked=False,
            driver__is_verified=True,
            driver__vehicle_type=vehicle_type,
        )

        if excluded_driver_ids:
            drivers_with_location = drivers_with_location.exclude(
                driver__id__in=excluded_driver_ids
            )

        nearby_drivers = []
        for driver_location in drivers_with_location:
            distance = haversine_distance(
                pickup_lat, pickup_lng,
                float(driver_location.latitude),
                float(driver_location.longitude),
            )

            if distance <= max_distance_km:
                nearby_drivers.append({
                    'driver':   driver_location.driver,
                    'distance': distance,
                    'location': driver_location,
                })

        nearby_drivers.sort(key=lambda x: x['distance'])
        return nearby_drivers[:limit]

    except Exception as e:
        logger.error(f"Error finding nearby drivers: {e}")
        return []


def find_best_drivers_for_task(task, max_distance_km=10, limit=5):
    """
    Find and score the best drivers for a task.
    Filters by vehicle type and capability before scoring.

    Args:
        task:            Task instance
        max_distance_km: search radius
        limit:           max drivers to return after scoring

    Returns:
        list of DriverProfile objects sorted by score
    """
    try:
        trip_distance_km = float(task.estimated_distance_km or 0)

        # Fetch IDs of drivers who already rejected or were lost on this task
        # so re-dispatch never re-offers to the same drivers
        excluded_driver_ids = set(
            TaskAssignment.objects.filter(
                task=task,
                outcome__in=['REJECTED', 'LOST']
            ).values_list('driver_id', flat=True)
        )

        # Get nearby drivers already filtered by vehicle type
        nearby_drivers_data = find_nearby_drivers(
            pickup_lat=float(task.pickup_lat),
            pickup_lng=float(task.pickup_lng),
            vehicle_type=task.vehicle_type,
            max_distance_km=max_distance_km,
            limit=limit * 2,
            excluded_driver_ids=excluded_driver_ids or None,
        )

        scored_drivers = []
        for driver_data in nearby_drivers_data:
            driver  = driver_data['driver']
            distance = driver_data['distance']

            # ── Capability double check ───────────────────────────
            # DB filter already handles vehicle_type matching
            # this catches edge cases like driver updated vehicle
            # after the query ran
            if not is_driver_capable(driver, trip_distance_km):
                continue

            # ── Scoring ───────────────────────────────────────────
            score = 0

            # Proximity to pickup (most important factor)
            if distance < 2:
                score += 50
            elif distance < 5:
                score += 30
            elif distance < 10:
                score += 10

            # Rating score — max 25 points
            if driver.user.rating > 0:
                score += min(float(driver.user.rating) * 5, 25)

            # Experience score — max 25 points
            if driver.total_tasks > 0:
                score += min(driver.total_tasks, 25)

            # Debt penalty — high debt = lower priority
            if driver.current_debt > 0:
                debt_ratio = (
                    driver.current_debt / driver.debt_limit
                    if driver.debt_limit > 0 else 1
                )
                score -= int(debt_ratio * 20)

            scored_drivers.append({
                'driver': driver,
                'score':  score,
                'distance': distance,
            })

        # Sort by score highest first
        scored_drivers.sort(key=lambda x: x['score'], reverse=True)

        result = [item['driver'] for item in scored_drivers[:limit]]

        logger.info(
            f"Task #{task.id} — "
            f"vehicle:{task.vehicle_type} "
            f"trip:{trip_distance_km}km — "
            f"{len(result)} drivers matched"
        )

        return result

    except Exception as e:
        logger.error(f"Error finding best drivers for task {task.id}: {e}")
        return []
