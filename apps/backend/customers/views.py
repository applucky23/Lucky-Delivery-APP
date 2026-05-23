import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import UserProfile, DriverProfile
from .serializers import UserProfileSerializer, DriverRegistrationSerializer, DriverProfileSerializer
from .services.driver_registration import register_driver

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


class DriverRegisterView(APIView):
    """
    POST /api/v1/driver/register/
    Called after Supabase OTP verification.
    Creates DriverProfile linked to the authenticated user.
    Images are Supabase Storage URLs sent by the frontend.
    New drivers start with is_verified=False — admin approves.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DriverRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = request.user

        profile, created = register_driver(user, data)

        return Response({
            'message': 'Driver profile submitted. Pending admin verification.',
            'driver':  DriverProfileSerializer(profile).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DriverProfileView(APIView):
    """
    GET /api/v1/driver/profile/
    Returns the authenticated driver's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = DriverProfile.objects.get(user=request.user)
            return Response(DriverProfileSerializer(profile).data)
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': 'Driver profile not found. Please complete registration.'},
                status=status.HTTP_404_NOT_FOUND
            )
