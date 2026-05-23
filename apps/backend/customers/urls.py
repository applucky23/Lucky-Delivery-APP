from django.urls import path
from .views import HealthCheckView, TestAuthView, UserProfileView, DriverRegisterView, DriverProfileView

urlpatterns = [
    path('health/',           HealthCheckView.as_view(),   name='health'),
    path('test-auth/',        TestAuthView.as_view(),       name='test-auth'),
    path('profile/',          UserProfileView.as_view(),    name='profile'),
    path('driver/register/',  DriverRegisterView.as_view(), name='driver-register'),
    path('driver/profile/',   DriverProfileView.as_view(),  name='driver-profile'),
]
