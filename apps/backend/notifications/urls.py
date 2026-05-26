from django.urls import path
from .views import (
    NotificationListView,MarkNotificationReadView,RegisterDeviceView,
    UnreadCountView,AnnouncementView,
)


urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:notification_id>/read/", MarkNotificationReadView.as_view(), name="notification-mark-read"),
    path("notifications/unread-count/", UnreadCountView.as_view(), name="notification-unread-count"),
    path("notifications/register-device/", RegisterDeviceView.as_view(), name="notification-register-device"),
    path("notifications/announce/", AnnouncementView.as_view(), name="notification-announce"),
]
