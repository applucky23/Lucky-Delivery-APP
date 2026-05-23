import logging
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# ─── Vehicle rules ────────────────────────────────────────────────
VEHICLE_MAX_DISTANCE = {
    "ON_FOOT":    5,
    "BICYCLE":    10,
    "MOTORCYCLE": 25,
    "CAR":        float("inf"),
    "MINI_TRUCK": float("inf"),
}

VEHICLE_LABELS = {
    "ON_FOOT":    "On-foot couriers",
    "BICYCLE":    "Cyclists",
    "MOTORCYCLE": "Motorcycle riders",
    "CAR":        "Car drivers",
    "MINI_TRUCK": "Mini truck drivers",
}


def assert_vehicle_capable(vehicle_type: str, distance_km: float):
    """
    Check requested vehicle type can handle this distance.
    Called at task creation before any driver is involved.
    Raises ValidationError if not capable.

    Args:
        vehicle_type: customer's requested vehicle type
        distance_km:  road distance from Mapbox
    """
    if not vehicle_type:
        raise ValidationError("Vehicle type is required.")

    max_km = VEHICLE_MAX_DISTANCE.get(vehicle_type, 0)
    if distance_km > max_km:
        label = VEHICLE_LABELS.get(vehicle_type, vehicle_type)
        raise ValidationError(
            f"{label} can only handle trips up to {max_km} km. "
            f"This task is {distance_km:.1f} km. "
            f"Please select a different vehicle type."
        )

    logger.debug(
        f"Vehicle capability passed — "
        f"{vehicle_type} for {distance_km}km "
        f"(max {max_km}km)"
    )


def is_driver_capable(driver, distance_km: float) -> bool:
    """
    Silent boolean check — driver's vehicle vs trip distance.
    Used in matching loop to filter unsuitable drivers quietly.

    Args:
        driver:       DriverProfile instance
        distance_km:  road distance stored on task

    Returns:
        True if driver's vehicle can handle the distance
    """
    vehicle = driver.vehicle_type
    if not vehicle:
        logger.warning(f"Driver {driver.id} has no vehicle type set")
        return False

    max_km = VEHICLE_MAX_DISTANCE.get(vehicle, 0)
    capable = distance_km <= max_km

    if not capable:
        logger.info(
            f"Driver {driver.id} ({vehicle}) skipped — "
            f"trip {distance_km}km exceeds {max_km}km limit"
        )

    return capable


def assert_driver_capable(driver, distance_km: float):
    """
    Loud check — raises ValidationError if driver cannot
    handle this distance. Used in manual assignment.

    Args:
        driver:       DriverProfile instance
        distance_km:  road distance stored on task
    """
    vehicle = driver.vehicle_type
    if not vehicle:
        raise ValidationError("Driver has no vehicle type set.")

    max_km = VEHICLE_MAX_DISTANCE.get(vehicle, 0)
    if distance_km > max_km:
        label = VEHICLE_LABELS.get(vehicle, vehicle)
        raise ValidationError(
            f"{label} can only handle trips up to {max_km} km. "
            f"This task is {distance_km:.1f} km."
        )

    logger.debug(
        f"Driver {driver.id} capability passed — "
        f"{vehicle} for {distance_km}km"
    )


def get_capable_vehicle_types(distance_km: float) -> list[str]:
    """
    Returns list of vehicle types capable of handling this distance.
    Used in matching to pre-filter driver queryset before scoring.

    Args:
        distance_km: road distance stored on task

    Returns:
        list of vehicle type strings
    """
    return [
        vehicle
        for vehicle, max_km in VEHICLE_MAX_DISTANCE.items()
        if distance_km <= max_km
    ]