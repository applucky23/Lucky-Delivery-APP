from rest_framework import serializers
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='user.phone_number', read_only=True)
    email = serializers.EmailField(source='user.email', required=False)

    class Meta:
        model  = UserProfile
        fields = ['id', 'name', 'phone', 'email', 'address', 'profile_image', 'created_at', 'updated_at']
        read_only_fields = ['id', 'phone', 'profile_image', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        # Handle email update on the User model
        user_data = validated_data.pop('user', {})
        if 'email' in user_data:
            instance.user.email = user_data['email']
            instance.user.save(update_fields=['email'])
        return super().update(instance, validated_data)
