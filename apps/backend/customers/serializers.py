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
