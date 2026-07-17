from django.urls import path
from .views import (
    HealthCheckView, TestAuthView, UserProfileView,
    DriverRegisterView, DriverProfileView, DriverProfileUpdateView,
    DriverLocationUpdateView, DriverRefreshView, DriverDashboardView,
    CreateRatingView, DriverRatingsView,
)

urlpatterns = [
    path('health/',                HealthCheckView.as_view(),        name='health'),
    path('test-auth/',             TestAuthView.as_view(),            name='test-auth'),
    path('profile/',               UserProfileView.as_view(),         name='profile'),
    path('driver/register/',       DriverRegisterView.as_view(),      name='driver-register'),
    path('driver/profile/',        DriverProfileView.as_view(),       name='driver-profile'),
    path('driver/profile/update/', DriverProfileUpdateView.as_view(), name='driver-profile-update'),
    path('driver/location/',       DriverLocationUpdateView.as_view(), name='driver-location'),
    path('driver/refresh/',        DriverRefreshView.as_view(),        name='driver-refresh'),
    path('driver/dashboard/',      DriverDashboardView.as_view(),      name='driver-dashboard'),
    path('tasks/<int:task_id>/rate/', CreateRatingView.as_view(),      name='task-rate'),
    path('driver/ratings/',           DriverRatingsView.as_view(),     name='driver-ratings'),
]
