from django.urls import path
from .views import NotificationListView, UnreadCountView, MarkReadView, MarkAllReadView

urlpatterns = [
    path('notifications/',              NotificationListView.as_view(), name='notifications'),
    path('notifications/unread-count/', UnreadCountView.as_view(),      name='notifications-unread'),
    path('notifications/<int:notification_id>/read/', MarkReadView.as_view(),    name='notifications-read'),
    path('notifications/read-all/',     MarkAllReadView.as_view(),     name='notifications-read-all'),
]
