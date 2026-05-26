import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from notifications.models import Notification, FCMDevice
from notifications.service import notify_all, notify_role
from tasks.permissions import IsAdminUser

logger = logging.getLogger(__name__)


# Create your views here.
class NotificationListView(APIView):
    """
    GET /notifications/
    Returns persistent notifications for the logged in user.
    Marks all as read on fetch.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            notifications = Notification.objects.filter(
                user=request.user,
                is_persistent=True,
            ).order_by('-created_at')

            # Mark all unread as read on open
            unread = notifications.filter(is_read=False)
            if unread.exists():
                unread.update(is_read=True, read_at=timezone.now())

            data = [
                {
                    "id":         n.id,
                    "type":       n.type,
                    "title":      n.title,
                    "message":    n.message,
                    "is_read":    n.is_read,
                    "read_at":    n.read_at,
                    "data":       n.data,
                    "created_at": n.created_at,
                }
                for n in notifications
            ]

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching notifications for user {request.user.id}: {e}")
            return Response(
                {"error": "Failed to fetch notifications"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MarkNotificationReadView(APIView):
    """
    POST /notifications/<id>/read/
    Mark a single notification as read.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=request.user,
            )
        except Notification.DoesNotExist:
            return Response(
                {"error": "Notification not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])

        return Response({"message": "Marked as read"}, status=status.HTTP_200_OK)


class RegisterDeviceView(APIView):
    """
    POST /notifications/register-device/
    Register or update an FCM device token for the logged in user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token    = request.data.get("token")
        platform = request.data.get("platform")

        if not token:
            return Response(
                {"error": "token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not platform:
            return Response(
                {"error": "platform is required (ANDROID or IOS)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if platform not in ["ANDROID", "IOS"]:
            return Response(
                {"error": "platform must be ANDROID or IOS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # If token exists for another user — reassign it
            # Handles device hand-offs and re-installs
            device, created = FCMDevice.objects.update_or_create(
                token=token,
                defaults={
                    "user":      request.user,
                    "platform":  platform,
                    "is_active": True,
                },
            )

            logger.info(
                f"FCM device {'registered' if created else 'updated'} — "
                f"user:{request.user.id} platform:{platform}"
            )

            return Response(
                {"message": "Device registered successfully"},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Device registration failed for user {request.user.id}: {e}")
            return Response(
                {"error": "Failed to register device"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UnreadCountView(APIView):
    """
    GET /notifications/unread-count/
    Returns count of unread persistent notifications.
    Used for badge count on the frontend.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            count = Notification.objects.filter(
                user=request.user,
                is_persistent=True,
                is_read=False,
            ).count()

            return Response({"unread_count": count}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching unread count for user {request.user.id}: {e}")
            return Response(
                {"error": "Failed to fetch unread count"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AnnouncementView(APIView):
    """
    POST /notifications/announce/
    Admin sends a broadcast announcement.

    Body:
        message:  str  — announcement text
        target:   str  — ALL | USER | DRIVER | ADMIN
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        message = request.data.get("message")
        target  = request.data.get("target", "ALL")

        if not message:
            return Response(
                {"error": "message is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target not in ["ALL", "USER", "DRIVER", "ADMIN"]:
            return Response(
                {"error": "target must be ALL, USER, DRIVER or ADMIN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            context = {"alert_message": message}

            if target == "ALL":
                count = notify_all(event="SYSTEM_ALERT", context=context)
            else:
                count = notify_role(event="SYSTEM_ALERT", role=target, context=context)

            logger.info(
                f"Announcement sent by admin {request.user.id} — "
                f"target:{target} recipients:{count}"
            )

            return Response(
                {
                    "message":    "Announcement sent successfully",
                    "recipients": count,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Announcement failed: {e}")
            return Response(
                {"error": "Failed to send announcement"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

