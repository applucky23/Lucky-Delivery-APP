NOTIFICATION_TEMPLATES = {

    # ─── Task offer & assignment ──────────────────────────────────
    "TASK_OFFER": {
        "title": "New Task Available",
        "message": "You have a new {task_type} task near you.",
    },
    "TASK_ASSIGNED": {
        "title": "Driver Assigned",
        "message": "Your driver {driver_name} is on the way.",
    },
    "TASK_TAKEN": {
        "title": "Task No Longer Available",
        "message": "Another driver has accepted this task.",
    },

    # ─── Task lifecycle ───────────────────────────────────────────
    "TASK_CANCELLED": {
        "title": "Task Cancelled",
        "message": "Your {task_type} task has been cancelled.",
    },
    "TASK_COMPLETED": {
        "title": "Task Completed",
        "message": "Your {task_type} task is complete — {final_price} ETB.",
    },
    "NO_DRIVERS_FOUND": {
        "title": "No Drivers Available",
        "message": "We couldn't find a driver for your {task_type} task. Please try again.",
    },

    # ─── Task progression ─────────────────────────────────────────
    "DRIVER_ARRIVED": {
        "title": "Driver Arrived",
        "message": "Your driver has arrived at the pickup location.",
    },
    "DRIVER_ON_THE_WAY": {
        "title": "On The Way",
        "message": "Your {task_type} is on the way to the dropoff location.",
    },

    # ─── Price flow ───────────────────────────────────────────────
    "PRICE_APPROVAL_REQUIRED": {
        "title": "Approval Required",
        "message": "Your driver is requesting approval for {item_cost} ETB.",
    },
    "PRICE_UPDATE": {
        "title": "Price Update",
        "message": "{price_message}",
    },

    # ─── Driver onboarding ────────────────────────────────────────
    "DRIVER_STATUS_UPDATE": {
        "title": "Application {status}",
        "message": "{status_message}",
    },

    # ─── Misc ─────────────────────────────────────────────────────
    "RATE_REMINDER": {
        "title": "How Was Your Experience?",
        "message": "{rate_message}",
    },
    "PAYMENT_REQUIRED": {
        "title": "Payment Required",
        "message": "You have an outstanding balance of {amount} ETB.",
    },
    "SYSTEM_ALERT": {
        "title": "System Alert",
        "message": "{alert_message}",
    },
}


def render_template(event: str, context: dict = None) -> dict:
    """
    Render notification title and message for a given event.
    Fills in placeholders from context dict.

    Args:
        event:   notification type string e.g. 'TASK_OFFER'
        context: dict of values to plug into placeholders

    Returns:
        {"title": str, "message": str}

    Example:
        render_template("TASK_OFFER", {"task_type": "Delivery"})
        → {"title": "New Task Available",
           "message": "You have a new Delivery task near you."}
    """
    context = context or {}
    template = NOTIFICATION_TEMPLATES.get(event)

    if not template:
        return {
            "title":   "Notification",
            "message": "You have a new notification.",
        }

    try:
        return {
            "title":   template["title"].format(**context),
            "message": template["message"].format(**context),
        }
    except KeyError:
        # Missing context key — return unformatted rather than crashing
        return {
            "title":   template["title"],
            "message": template["message"],
        }