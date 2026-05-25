import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Mapbox takes lng,lat — NOT lat,lng like everything else
MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/{profile}/{coords}"

VEHICLE_TO_MAPBOX_PROFILE = {
    "ON_FOOT":    "walking",
    "BICYCLE":    "cycling",
    "MOTORCYCLE": "driving",
    "CAR":        "driving",
    "MINI_TRUCK": "driving",
}


def get_route_data(origin: tuple[float, float], destination: tuple[float, float], vehicle_type: str = "MOTORCYCLE") -> dict:
    """
    Calculate road distance and duration between two coordinate pairs
    using Mapbox Directions API.

    Args:
        origin:       (lat, lng) of pickup
        destination:  (lat, lng) of dropoff
        vehicle_type: DriverProfile vehicle type — used to select Mapbox routing profile

    Returns:
        {
            "distance_km": float,
            "duration_minutes": float
        }

    Raises:
        ValueError on any failure
    """
    # Mapbox expects lng,lat — we flip here explicitly
    pickup_lng, pickup_lat = origin[1], origin[0]
    dropoff_lng, dropoff_lat = destination[1], destination[0]

    profile = VEHICLE_TO_MAPBOX_PROFILE.get(vehicle_type, "driving")
    coords = f"{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}"
    url = MAPBOX_DIRECTIONS_URL.format(profile=profile, coords=coords)

    try:
        response = requests.get(
            url,
            params={
                "access_token": settings.MAPBOX_ACCESS_TOKEN,
                "geometries": "geojson",
                "overview": "false",  # we dont need the route shape, just distance
                "steps": "false",     # no turn by turn, saves response size
            },
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        code = data.get("code")
        if code != "Ok":
            logger.warning(
                f"Mapbox routing failed for {origin} → {destination}: {code}"
            )
            raise ValueError(f"No route found between these locations")

        routes = data.get("routes")
        if not routes:
            raise ValueError("No routes returned from Mapbox")

        route = routes[0]
        distance_km = route["distance"] / 1000        # meters → km
        duration_minutes = route["duration"] / 60     # seconds → minutes

        return {
            "distance_km": round(distance_km, 2),
            "duration_minutes": round(duration_minutes, 1),
        }

    except requests.Timeout:
        logger.error(f"Mapbox timeout for {origin} → {destination}")
        raise ValueError("Routing service timed out")
    except requests.RequestException as e:
        logger.error(f"Mapbox request error: {e}")
        raise ValueError("Routing service unavailable")
    except (KeyError, IndexError) as e:
        logger.error(f"Unexpected Mapbox response structure: {e}")
        raise ValueError("Invalid routing response")
