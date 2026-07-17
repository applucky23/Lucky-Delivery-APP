import logging
import math
from django.db import IntegrityError
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from tasks.permissions import IsDriver
from tasks.serializers import TaskAssignmentSerializer
from tasks.services.assignment_expiry import expire_stale_assignments
from tasks.utils import get_driver_profile_or_404
from .models import (
    DriverLocation, DriverProfile,
    Rating, Task, TaskAssignment, UserProfile,
)
from .serializers import (
    CreateRatingSerializer, DriverProfileSerializer,
    DriverProfileUpdateSerializer, DriverRegistrationSerializer,
    UserProfileSerializer,
)
from .services.driver_dispatch import redispatch_nearby_tasks
from .services.driver_registration import register_driver
from .services.rating_service import check_already_rated


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

        profile, created = register_driver(request.user, serializer.validated_data)

        return Response({
            'message': 'Driver profile submitted. Pending admin verification.',
            'driver':  DriverProfileSerializer(profile).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DriverProfileView(APIView):
    """
    GET /api/v1/driver/profile/
    Returns the authenticated driver's profile.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            profile = DriverProfile.objects.get(user=request.user)
            return Response(DriverProfileSerializer(profile).data)
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': 'Driver profile not found. Please complete registration.'},
                status=status.HTTP_404_NOT_FOUND
            )


class DriverProfileUpdateView(APIView):
    """
    PATCH /api/v1/driver/profile/update/
    Driver updates their own editable profile fields.
    Re-dispatches unassigned PENDING tasks when driver comes online.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def patch(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        was_offline = not profile.is_online
        was_available = profile.is_available
        serializer = DriverProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Sync is_available with is_online — online drivers are available
            if was_offline and profile.is_online:
                profile.is_available = True
                profile.save(update_fields=['is_available'])
                redispatch_nearby_tasks(profile)
            elif not profile.is_online and was_available:
                profile.is_available = False
                profile.save(update_fields=['is_available'])
            return Response(DriverProfileSerializer(profile).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DriverLocationUpdateView(APIView):
    """
    POST /api/v1/driver/location/
    Updates the driver's current GPS location.
    Creates a DriverLocation record if one doesn't exist.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        try:
            driver_profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if latitude is None or longitude is None:
            return Response({'error': 'latitude and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid coordinates'}, status=status.HTTP_400_BAD_REQUEST)

        loc, created = DriverLocation.objects.update_or_create(
            driver=driver_profile,
            defaults={'latitude': latitude, 'longitude': longitude},
        )

        # If driver just reported location for the first time and is online,
        # re-dispatch nearby tasks (catches the race where going online
        # triggered re-dispatch before location was known)
        if created and driver_profile.is_online:
            redispatch_nearby_tasks(driver_profile, location=loc)

        return Response({'message': 'Location updated'}, status=status.HTTP_200_OK)


class DriverRefreshView(APIView):
    """
    POST /api/v1/driver/refresh/
    Triggers re-dispatch for nearby pending tasks + returns updated profile/assignments.
    Used by pull-to-refresh on the driver home screen.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        expire_stale_assignments()

        if profile.is_online:
            redispatch_nearby_tasks(profile)

        assignments = TaskAssignment.objects.filter(
            driver=profile,
            outcome='PENDING',
        ).select_related('task', 'task__user', 'task__driver', 'task__driver__user').order_by('-notified_at')

        return Response({
            'assignments': TaskAssignmentSerializer(assignments, many=True).data,
            'is_online': profile.is_online,
        })


class DriverDashboardView(APIView):
    """
    GET /api/v1/driver/dashboard/
    Returns assignments + earnings + latest commission payment in one request.
    Replaces 3 separate calls for polling efficiency.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # ── Assignments ──────────────────────────────────────────────
        assignments = TaskAssignment.objects.filter(
            driver=profile, outcome='PENDING'
        ).select_related('task', 'task__user', 'task__driver', 'task__driver__user').order_by('-notified_at')

        # ── Earnings + latest payment (delegated to payments app) ────
        from payments.views import _earnings_totals
        from .models import CommissionPayment
        totals = _earnings_totals(profile, timezone.now())
        latest = CommissionPayment.objects.filter(driver=profile).order_by('-created_at').first()

        return Response({
            'assignments': TaskAssignmentSerializer(assignments, many=True).data,
            'earnings': {
                'balance': str(profile.balance),
                'debt':    str(profile.current_debt),
                'daily':   str(totals['daily']),
                'weekly':  str(totals['weekly']),
                'monthly': str(totals['monthly']),
            },
            'latest_payment': {
                'id':         latest.id,
                'amount':     str(latest.amount),
                'status':     latest.status,
                'admin_note': latest.admin_note,
            } if latest else None,
        })


class CreateRatingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        serializer = CreateRatingSerializer(
            data=request.data,
            context={'request': request, 'task_id': task_id},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rating = serializer.save()
        return Response({
            'id':         rating.id,
            'rating':     rating.rating,
            'comment':    rating.comment,
            'created_at': rating.created_at,
        }, status=status.HTTP_201_CREATED)

    def get(self, request, task_id):
        # Single query: fetch the rating directly; absence means either no task or not rated
        rating = check_already_rated(request.user, task_id)
        if rating:
            return Response({
                'id':         rating.id,
                'rating':     rating.rating,
                'comment':    rating.comment,
                'created_at': rating.created_at,
            })
        if not Task.objects.filter(id=task_id).exists():
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'rated': False}, status=status.HTTP_200_OK)


class DriverRatingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'DRIVER':
            return Response({'error': 'Only drivers can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        driver_profile = get_driver_profile_or_404(request.user)
        ratings = Rating.objects.filter(to_user=driver_profile.user)
        agg = ratings.aggregate(avg=Avg('rating'), count=Count('id'))
        recent = ratings.select_related('from_user', 'from_user__profile').order_by('-created_at')[:5]

        avg_val = float(agg['avg']) if agg['avg'] else 0.0

        return Response({
            'average_rating': avg_val if not math.isnan(avg_val) else 0.0,
            'rating_count': agg['count'],
            'recent_reviews': [
                {
                    'rating':             r.rating,
                    'comment':            r.comment,
                    'from_customer_name': getattr(r.from_user, 'profile', None) and r.from_user.profile.name or r.from_user.username,
                    'created_at':         r.created_at,
                }
                for r in recent
            ],
        })
