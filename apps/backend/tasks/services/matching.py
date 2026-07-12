from django.db.models import F
from customers.models import DriverProfile, DriverLocation
from math import radians, cos, sin, asin, sqrt
import logging

logger = logging.getLogger(__name__)

VEHICLE_TIER = {
    'ON_FOOT': 0,
    'BICYCLE': 1,
    'MOTORCYCLE': 2,
    'CAR': 2,
    'MINI_TRUCK': 2,
}

FOOT = 0
BIKE = 2

TIER_MAX_TASK_KM = {
    0: 1.5,   # foot: max 1.5 km task distance
    1: 5.0,   # bicycle: max 5 km task distance
    2: 999,   # motorcycle / car: any distance
}


def haversine_distance(lat1, lon1, lat2, lon2):
    # TODO: Replace haversine Python loop with PostGIS geo queries for production scaling
    """
    Calculate the great circle distance between two points 
    on earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r


def find_nearby_drivers(pickup_lat, pickup_lng, max_distance_km=10, limit=5):
    """
    Find nearby drivers based on pickup location
    
    Args:
        pickup_lat (float): Pickup latitude
        pickup_lng (float): Pickup longitude  
        max_distance_km (int): Maximum distance to search (default: 10km)
        limit (int): Maximum number of drivers to return (default: 5)
    
    Returns:
        list: List of DriverProfile objects sorted by distance
    """
    try:
        # Get all online, available drivers with location data
        drivers_with_location = DriverLocation.objects.select_related('driver', 'driver__user').filter(
            driver__is_online=True,
            driver__is_available=True,
            driver__is_blocked=False,
            driver__is_verified=True,
        )
        
        # Calculate distances and filter by max distance
        nearby_drivers = []
        for driver_location in drivers_with_location:
            distance = haversine_distance(
                pickup_lat, pickup_lng,
                float(driver_location.latitude), 
                float(driver_location.longitude)
            )
            
            if distance <= max_distance_km:
                nearby_drivers.append({
                    'driver': driver_location.driver,
                    'distance': distance,
                    'location': driver_location
                })
        
        # Sort by distance and limit results
        nearby_drivers.sort(key=lambda x: x['distance'])
        return nearby_drivers[:limit]
        
    except Exception as e:
        logger.error(f"Error finding nearby drivers: {e}")
        return []


def find_best_drivers_for_task(task, max_distance_km=10, limit=5):
    """
    Find the best drivers for a specific task, filtering by vehicle type
    hard limits based on task.estimated_distance_km (pickup → dropoff).

    Vehicle max task distances:
      Foot       ≤ 1.5 km
      Bicycle    ≤ 5 km
      Motorcycle   any
    """
    try:
        task_distance_km = task.estimated_distance_km or 0

        nearby_drivers_data = find_nearby_drivers(
            float(task.pickup_lat), 
            float(task.pickup_lng),
            max_distance_km,
            limit * 2
        )

        if not nearby_drivers_data:
            return []

        eligible = []
        for driver_data in nearby_drivers_data:
            driver = driver_data['driver']
            t = VEHICLE_TIER.get(driver.vehicle_type, BIKE)
            max_task_km = TIER_MAX_TASK_KM.get(t, 5.0)
            if task_distance_km > max_task_km:
                continue
            eligible.append(driver_data)

        if not eligible:
            return []

        scored = []
        for d in eligible:
            driver = d['driver']
            dist = d['distance']
            score = 0
            if dist < 2:
                score += 50
            elif dist < 5:
                score += 30
            elif dist < 10:
                score += 10
            if driver.user.rating > 0:
                score += min(float(driver.user.rating) * 5, 25)
            if driver.total_tasks > 0:
                score += min(driver.total_tasks, 25)
            if driver.is_available:
                score += 10
            if driver.is_verified:
                score += 15
            if driver.current_debt > 0:
                debt_ratio = driver.current_debt / driver.debt_limit if driver.debt_limit > 0 else 1
                score -= int(debt_ratio * 20)
            scored.append((score, driver))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [driver for _, driver in scored[:limit]]

    except Exception as e:
        logger.error(f"Error finding best drivers for task {task.id}: {e}")
        return []
