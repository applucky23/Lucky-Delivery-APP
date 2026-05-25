import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from core.services.maps.routing import get_route_data
from core.services.capabilities import assert_vehicle_capable
from .pricing import calculate_estimated_price
from .task_assignment import dispatch

logger = logging.getLogger(__name__)


@transaction.atomic
def create_task(task) -> object:
    """
    Post-creation orchestrator.
    Task already saved by serializer —
    enriches it with route data, validates capability,
    calculates price, then dispatches.

    Flow:
        1. Get route from Mapbox
        2. Validate vehicle capability for distance
        3. Calculate estimated price
        4. Update task with computed fields
        5. Dispatch to matching

    Args:
        task: Task instance already saved by serializer

    Returns:
        Task instance with all fields populated

    Raises:
        ValidationError if routing fails or vehicle incapable
    """

    # ─── Step 1: Get route from Mapbox ────────────────────────────
    try:
        route = get_route_data(
            origin=(float(task.pickup_lat), float(task.pickup_lng)),
            destination=(float(task.dropoff_lat), float(task.dropoff_lng)),
            vehicle_type=task.vehicle_type,
        )
    except ValueError as e:
        logger.error(f"Routing failed for task #{task.id}: {e}")
        raise ValidationError(f"Could not calculate route: {e}")

    distance_km      = route["distance_km"]
    duration_minutes = route["duration_minutes"]

    # ─── Step 2: Capability check ─────────────────────────────────
    # Fails fast before pricing or dispatch
    # Transaction rolls back task if this raises
    assert_vehicle_capable(task.vehicle_type, distance_km)

    # ─── Step 3: Calculate estimated price ───────────────────────
    estimated_price = calculate_estimated_price(
        task_type=task.type,
        distance_km=distance_km,
        vehicle_type=task.vehicle_type,
        is_return_trip=task.is_return_trip,
    )

    # ─── Step 4: Update task with computed fields ─────────────────
    task.estimated_distance_km = Decimal(str(distance_km))
    task.estimated_duration_minutes = Decimal(str(duration_minutes))
    task.estimated_price = estimated_price
    task.save(update_fields=[
        'estimated_distance_km',
        'estimated_duration_minutes',
        'estimated_price',
    ])

    logger.info(
        f"Task #{task.id} created — "
        f"type:{task.type} "
        f"vehicle:{task.vehicle_type} "
        f"dist:{distance_km}km "
        f"duration:{duration_minutes}mins "
        f"estimate:{estimated_price} ETB"
    )

    # ─── Step 5: Dispatch ─────────────────────────────────────────
    dispatch(task)

    return task