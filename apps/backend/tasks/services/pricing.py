import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

# ─── Base fees per task type (ETB) ───────────────────────────────
BASE_FEES = {
    "DELIVERY": Decimal("40.00"),
    "SHOPPING": Decimal("50.00"),
    "ERRAND":   Decimal("35.00"),
}

# ─── Service fees per task type (ETB) ────────────────────────────
SERVICE_FEES = {
    "DELIVERY": Decimal("0.00"),
    "SHOPPING": Decimal("15.00"),
    "ERRAND":   Decimal("10.00"),
}

# ─── Per km rate per vehicle type (ETB) ──────────────────────────
PER_KM_RATE = {
    "ON_FOOT":    Decimal("5.00"),
    "BICYCLE":    Decimal("7.00"),
    "MOTORCYCLE": Decimal("10.00"),
    "CAR":        Decimal("15.00"),
    "MINI_TRUCK": Decimal("20.00"),
}

DEFAULT_PER_KM_RATE  = Decimal("10.00")  # fallback — motorcycle rate
RETURN_TRIP_MULTIPLIER = Decimal("1.7")  # discounted return, not full 2x


def calculate_estimated_price(
    task_type: str,
    distance_km: float,
    vehicle_type: str | None = None,
    is_return_trip: bool = False,
) -> Decimal:
    """
    Calculate estimated price at task creation time.
    No driver assigned yet — vehicle_type is None,
    falls back to default motorcycle rate.

    Args:
        task_type:      DELIVERY | SHOPPING | ERRAND
        distance_km:    road distance from Mapbox
        vehicle_type:   None at creation, no driver yet
        is_return_trip: from request data

    Returns:
        Decimal estimated price in ETB
    """
    base_fee     = BASE_FEES.get(task_type, Decimal("40.00"))
    service_fee  = SERVICE_FEES.get(task_type, Decimal("0.00"))
    per_km       = PER_KM_RATE.get(vehicle_type, DEFAULT_PER_KM_RATE)
    distance     = Decimal(str(distance_km))

    price = base_fee + service_fee + (per_km * distance)

    if is_return_trip:
        price *= RETURN_TRIP_MULTIPLIER

    logger.debug(
        f"Estimated price — type:{task_type} dist:{distance_km}km "
        f"vehicle:{vehicle_type} return:{is_return_trip} → {price} ETB"
    )

    return price.quantize(Decimal("0.01"))
