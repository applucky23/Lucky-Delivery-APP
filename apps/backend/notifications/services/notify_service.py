import logging
from django.contrib.auth import get_user_model
from notifications.models import Notification, FCMDevice
from .templates import render_template
from .fcm import send_push, send_push_many

logger = logging.getLogger(__name__)
User = get_user_model()

PERSISTENT_EVENTS = {
    "SYSTEM_ALERT",
    "DRIVER_STATUS_UPDATE",
    "PAYMENT_REQUIRED",
}


def _get_active_tokens(user) -> list[str]:
    """
    Get all active FCM tokens for a user.
    """
    return list(
        FCMDevice.objects.filter(
            user=user,
            is_active=True,
        ).values_list('token', flat=True)
    )


def _get_active_tokens_for_users(users) -> list[str]:
    """
    Get all active FCM tokens for a list of users.
    """
    return list(
        FCMDevice.objects.filter(
            user__in=users,
            is_active=True,
        ).values_list('token', flat=True)
    )


def notify(event: str, user, task=None, context: dict = None, data: dict = None) -> Notification | None:
    """
    Send a notification to a single user.
    Creates DB record + sends FCM push.

    Args:
        event:   notification type e.g. 'TASK_OFFER'
        user:    User instance
        task:    optional Task instance
        context: template placeholder values
        data:    extra JSON payload for the app

    Returns:
        Notification instance or None on failure
    """
    try:
        rendered = render_template(event, context or {})

        # ── Save to DB ────────────────────────────────────────────
        notification = Notification.objects.create(
            user=user,
            type=event,
            title=rendered["title"],
            message=rendered["message"],
            task=task,
            data=data or {},
            is_persistent=event in PERSISTENT_EVENTS,
        )

        # ── Send FCM push ─────────────────────────────────────────
        tokens = _get_active_tokens(user)
        if tokens:
            for token in tokens:
                send_push(
                    token=token,
                    title=rendered["title"],
                    message=rendered["message"],
                    data=data or {},
                )

        logger.info(
            f"Notification sent — "
            f"event:{event} "
            f"user:{user.id} "
            f"tokens:{len(tokens)}"
        )

        return notification

    except Exception as e:
        logger.error(f"notify() failed — event:{event} user:{user.id} error:{e}")
        return None


def notify_many(event: str, users, task=None, context: dict = None, data: dict = None) -> int:
    """
    Send a notification to a list of users.
    Bulk creates DB records + sends FCM multicast.

    Args:
        event: notification type
        users: list or queryset of User instances
        task:  optional Task instance
        context: template placeholder values
        data:  extra JSON payload

    Returns:
        count of notifications created
    """
    try:
        users = list(users)
        if not users:
            return 0

        rendered = render_template(event, context or {})

        # ── Bulk save to DB ───────────────────────────────────────
        notifications = Notification.objects.bulk_create([
            Notification(
                user=user,
                type=event,
                title=rendered["title"],
                message=rendered["message"],
                task=task,
                data=data or {},
                is_persistent=event in PERSISTENT_EVENTS,
            )
            for user in users
        ])

        # ── Send FCM multicast ────────────────────────────────────
        tokens = _get_active_tokens_for_users(users)
        if tokens:
            send_push_many(
                tokens=tokens,
                title=rendered["title"],
                message=rendered["message"],
                data=data or {},
            )

        logger.info(
            f"Bulk notification sent — "
            f"event:{event} "
            f"users:{len(users)} "
            f"tokens:{len(tokens)}"
        )

        return len(notifications)

    except Exception as e:
        logger.error(f"notify_many() failed — event:{event} error:{e}")
        return 0


def notify_role(event: str, role: str, task=None, context: dict = None, data: dict = None) -> int:
    """
    Send a notification to all users with a specific role.

    Args:
        event: notification type
        role:  USER | DRIVER | ADMIN
        task:  optional Task instance
        context: template placeholder values
        data:  extra JSON payload

    Returns:
        count of notifications created
    """
    users = User.objects.filter(role=role, is_active=True)
    return notify_many(
        event=event,
        users=users,
        task=task,
        context=context,
        data=data,
    )


def notify_all(event: str, context: dict = None, data: dict = None) -> int:
    """
    Send a notification to every active user.
    Used for global announcements.

    Args:
        event:   notification type
        context: template placeholder values
        data:    extra JSON payload

    Returns:
        count of notifications created
    """
    users = User.objects.filter(is_active=True)
    return notify_many(
        event=event,
        users=users,
        context=context,
        data=data,
    )


# ─── Convenience wrappers ─────────────────────────────────────────
# Only where they hide real complexity or repeated boilerplate.
# Simple single-context-key calls go directly through notify() at the call site.

def notify_welcome_customer(user) -> None:
    """Sent immediately when a customer registers."""
    notify(
        event="SYSTEM_ALERT",
        user=user,
        context={"alert_message": "Welcome! Start your first task now."},
        data={"screen": "home"},
    )


def notify_welcome_driver(user) -> None:
    """Sent immediately when a driver submits registration."""
    notify(
        event="DRIVER_STATUS_UPDATE",
        user=user,
        context={
            "status": "Under Review",
            "status_message": "Your application is under review. We'll notify you once approved.",
        },
        data={"screen": "driver_status", "status": "UNDER_REVIEW"},
    )


def notify_driver_approved(user) -> None:
    """Sent when admin approves a driver."""
    notify(
        event="DRIVER_STATUS_UPDATE",
        user=user,
        context={
            "status": "Approved",
            "status_message": "Congratulations! Your driver account has been approved. You can start accepting tasks.",
        },
        data={"screen": "driver_status", "status": "APPROVED"},
    )


def notify_driver_rejected(user, reason: str = "") -> None:
    """Sent when admin rejects a driver."""
    notify(
        event="DRIVER_STATUS_UPDATE",
        user=user,
        context={
            "status": "Rejected",
            "status_message": f"Your application was rejected.{' Reason: ' + reason if reason else ''}",
        },
        data={"screen": "driver_status", "status": "REJECTED"},
    )


def notify_admin_new_driver(user) -> None:
    """Sent to all admins when a new driver registers."""
    notify_role(
        event="SYSTEM_ALERT",
        role="ADMIN",
        context={"alert_message": f"New driver registration from {user.username} is pending review."},
        data={"screen": "admin_driver_review", "driver_id": user.id},
    )


# ─── Task lifecycle wrappers ──────────────────────────────────────
# Only kept where driver_profiles → users extraction is needed (non-obvious)
# or where multiple context keys make direct calls noisy.

def notify_task_offer(driver_profiles, task) -> int:
    """Sent to all candidate drivers when a task is dispatched.
    Extracts user from each driver profile before passing to notify_many.
    """
    users = [dp.user for dp in driver_profiles]
    return notify_many(
        event="TASK_OFFER",
        users=users,
        task=task,
        context={"task_type": task.get_type_display()},
        data={
            "screen": "task_offer",
            "task_id": task.id,
            "task_type": task.type,
            "pickup_lat": str(task.pickup_lat),
            "pickup_lng": str(task.pickup_lng),
        },
    )


def notify_task_taken(driver_profiles, task) -> int:
    """Sent to losing drivers when another driver accepts the task.
    Extracts user from each driver profile before passing to notify_many.
    """
    users = [dp.user for dp in driver_profiles]
    return notify_many(
        event="TASK_TAKEN",
        users=users,
        task=task,
        data={"screen": "home", "task_id": task.id},
    )


def notify_price_approved(driver_profile, task) -> None:
    """Sent to the driver when the customer approves the item cost.
    Extracts user from driver profile.
    """
    notify(
        event="PRICE_UPDATE",
        user=driver_profile.user,
        task=task,
        context={"price_message": "The customer approved your quoted amount. Proceed with the purchase."},
        data={"screen": "active_task", "task_id": task.id, "price_approved": "true"},
    )


def notify_price_rejected(driver_profile, task) -> None:
    """Sent to the driver when the customer rejects the item cost.
    Extracts user from driver profile.
    """
    notify(
        event="PRICE_UPDATE",
        user=driver_profile.user,
        task=task,
        context={"price_message": "The customer rejected your quoted amount. The task has been cancelled."},
        data={"screen": "home", "task_id": task.id, "price_approved": "false"},
    )


def notify_commission_added(driver_profile, task, commission) -> None:
    """Sent to the driver after task completion with their commission debt.
    Extracts user from driver profile and includes commission amount in data.
    """
    notify(
        event="PRICE_UPDATE",
        user=driver_profile.user,
        task=task,
        context={"price_message": f"Task completed. {commission} ETB commission has been added to your balance."},
        data={"screen": "earnings", "task_id": task.id, "commission": str(commission)},
    )
