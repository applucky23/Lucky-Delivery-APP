import logging
import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Initialize Firebase app once ────────────────────────────────
# Guard prevents re-initialization on server reload
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)


def send_push(token: str, title: str, message: str, data: dict = None) -> bool:
    """
    Send a push notification to a single device token.

    Args:
        token:   FCM device token
        title:   notification title
        message: notification body
        data:    optional extra payload for the app to handle

    Returns:
        True if sent successfully, False otherwise
    """
    try:
        msg = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=message,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    priority="high",
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound="default",
                        badge=1,
                    )
                )
            ),
        )

        response = messaging.send(msg)
        logger.debug(f"Push sent successfully: {response}")
        return True

    except messaging.UnregisteredError:
        # Token is no longer valid — deactivate it
        logger.warning(f"FCM token unregistered, deactivating: {token[:20]}...")
        _deactivate_token(token)
        return False

    except messaging.SenderIdMismatchError:
        logger.error(f"FCM sender ID mismatch for token: {token[:20]}...")
        return False

    except Exception as e:
        logger.error(f"FCM push failed: {e}")
        return False


def send_push_many(tokens: list[str], title: str, message: str, data: dict = None) -> dict:
    """
    Send push notification to multiple device tokens.
    Uses FCM MulticastMessage — one API call for up to 500 tokens.

    Args:
        tokens:  list of FCM device tokens
        title:   notification title
        message: notification body
        data:    optional extra payload

    Returns:
        {"success": int, "failed": int}
    """
    if not tokens:
        return {"success": 0, "failed": 0}

    try:
        msg = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=message,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    priority="high",
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound="default",
                        badge=1,
                    )
                )
            ),
        )

        response = messaging.send_each_for_multicast(msg)

        # Deactivate any invalid tokens from the response
        if response.failure_count > 0:
            for idx, result in enumerate(response.responses):
                if not result.success:
                    _deactivate_token(tokens[idx])

        logger.info(
            f"Multicast push — "
            f"success:{response.success_count} "
            f"failed:{response.failure_count}"
        )

        return {
            "success": response.success_count,
            "failed":  response.failure_count,
        }

    except Exception as e:
        logger.error(f"FCM multicast push failed: {e}")
        return {"success": 0, "failed": len(tokens)}


def _deactivate_token(token: str):
    """
    Mark a device token as inactive.
    Called automatically when FCM returns UnregisteredError.
    """
    try:
        from notifications.models import FCMDevice
        FCMDevice.objects.filter(token=token).update(is_active=False)
        logger.info(f"FCM token deactivated: {token[:20]}...")
    except Exception as e:
        logger.error(f"Failed to deactivate token: {e}")