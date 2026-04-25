from django.urls import path
from .views import HealthCheckView, TestAuthView, UserProfileView

urlpatterns = [
    path('health/',    HealthCheckView.as_view(), name='health'),
    path('test-auth/', TestAuthView.as_view(),    name='test-auth'),
    path('profile/',   UserProfileView.as_view(), name='profile'),
]
