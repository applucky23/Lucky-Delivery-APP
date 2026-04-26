import logging
from django.db import IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import UserProfile
from .serializers import UserProfileSerializer

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'message': 'Lucky backend is running.'})


class TestAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        logger.info(f'[TestAuth] user id={user.id} phone={user.phone_number}')
        return Response({
            'message':      'Authenticated',
            'user_id':      user.id,
            'phone':        user.phone_number,
            'role':         user.role,
            'supabase_uid': str(user.supabase_uid) if user.supabase_uid else None,
        })


class UserProfileView(APIView):
    """
    GET  /api/profile/  — get current user's profile
    PUT  /api/profile/  — create or update current user's profile
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile, created = UserProfile.objects.get_or_create(
                user=request.user,
                defaults={'name': request.user.username}
            )
            if created:
                logger.info(f'[Profile] Created profile for user id={request.user.id}')
        except IntegrityError:
            profile = UserProfile.objects.get(user=request.user)
        return Response(UserProfileSerializer(profile).data)

    def put(self, request):
        try:
            profile, created = UserProfile.objects.get_or_create(
                user=request.user,
                defaults={'name': request.user.username}
            )
            if created:
                logger.info(f'[Profile] Created profile for user id={request.user.id}')
        except IntegrityError:
            profile = UserProfile.objects.get(user=request.user)
        
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f'[Profile] Updated user id={request.user.id} name={profile.name}')
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
