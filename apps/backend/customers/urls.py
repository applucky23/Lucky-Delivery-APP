from django.urls import path
from .views import TestAuthView

urlpatterns = [
    path('test-auth/', TestAuthView.as_view(), name='test-auth'),
]
