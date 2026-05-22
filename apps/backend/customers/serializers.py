from rest_framework import serializers
from django.core.validators import URLValidator, ValidationError
from .models import UserProfile
from django.db import transaction


class UserProfileSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='user.phone_number', read_only=True)
    email = serializers.EmailField(source='user.email', required=False, allow_blank=True)
    profile_image = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model  = UserProfile
        fields = ['id', 'name', 'phone', 'email', 'address', 'profile_image', 'created_at', 'updated_at']
        read_only_fields = ['id', 'phone', 'created_at', 'updated_at']

    def validate_profile_image(self, value):
        """Validate profile_image URL if provided."""
        if value:
            try:
                URLValidator()(value)
            except ValidationError:
                raise serializers.ValidationError("Invalid URL format for profile image.")
        return value

    def validate_address(self, value):
        """Validate address field."""
        if value and len(value.strip()) < 4:
            raise serializers.ValidationError("Address must be at least 4 characters long if provided.")
        return value.strip() if value else value

    def validate_email(self, value):
        """Validate email field."""
        if value:
            # Additional email validation can be added here
            return value.lower().strip()
        return value

    def update(self, instance, validated_data):
        """Update profile and handle email update on User model."""
        # Handle email update on the User model
        with transaction.atomic():  # Ensure atomicity of the update
            user_data = validated_data.pop('user', {})
            if 'email' in user_data:
                instance.user.email = user_data['email']
                instance.user.save(update_fields=['email'])

            # Update profile fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.save()  # This will automatically update updated_at
        return instance


class DriverRegistrationSerializer(serializers.Serializer):
    """
    Handles driver signup — creates/updates User with role=DRIVER
    and creates DriverProfile with is_verified=False.
    Frontend sends Supabase image URLs (not actual files).
    """
    full_name    = serializers.CharField(max_length=100)
    area         = serializers.CharField(max_length=100)
    vehicle_type = serializers.ChoiceField(choices=[
        'MOTORCYCLE', 'BICYCLE', 'CAR', 'MINI_TRUCK', 'ON_FOOT'
    ])
    id_image     = serializers.URLField(required=False, allow_blank=True)
    face_image   = serializers.URLField(required=False, allow_blank=True)
    email        = serializers.EmailField(required=False, allow_blank=True)

    def validate_id_image(self, value):
        if value:
            try:
                URLValidator()(value)
            except ValidationError:
                raise serializers.ValidationError('Invalid URL for id_image.')
        return value

    def validate_face_image(self, value):
        if value:
            try:
                URLValidator()(value)
            except ValidationError:
                raise serializers.ValidationError('Invalid URL for face_image.')
        return value


class DriverProfileSerializer(serializers.ModelSerializer):
    """Read serializer for returning driver profile data."""
    phone        = serializers.CharField(source='user.phone_number', read_only=True)
    email        = serializers.CharField(source='user.email', read_only=True)
    supabase_uid = serializers.CharField(source='user.supabase_uid', read_only=True)

    class Meta:
        from .models import DriverProfile
        model  = DriverProfile
        fields = [
            'id', 'full_name', 'phone', 'email', 'supabase_uid',
            'area', 'vehicle_type', 'id_image', 'face_image', 'profile_image',
            'status', 'rejection_reason',
            'is_available', 'is_verified', 'is_online', 'is_blocked',
            'total_tasks', 'created_at',
        ]
        read_only_fields = fields


class DriverProfileUpdateSerializer(serializers.ModelSerializer):
    """Writable serializer — only safe fields the driver can update themselves."""
    class Meta:
        from .models import DriverProfile
        model  = DriverProfile
        fields = ['full_name', 'area', 'vehicle_type', 'profile_image', 'is_available', 'is_online']
