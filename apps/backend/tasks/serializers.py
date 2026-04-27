from rest_framework.serializers import ModelSerializer, ValidationError
from rest_framework import serializers
from customers.models import Task


class TaskSerializer(ModelSerializer):
    """Basic serializer for tasks - used by drivers and admins"""
    pickup_lat = serializers.DecimalField(min_value=-90, max_value=90, max_digits=10, decimal_places=8)
    pickup_lng = serializers.DecimalField(min_value=-180, max_value=180, max_digits=10, decimal_places=8)
    dropoff_lat = serializers.DecimalField(min_value=-90, max_value=90, max_digits=10, decimal_places=8)
    dropoff_lng = serializers.DecimalField(min_value=-180, max_value=180,max_digits=10, decimal_places=8)
    class Meta:
        model = Task
        fields = [
            'id', 'type', 'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng',
            'estimated_distance_km', 'estimated_price', 'final_price', 'waiting_time_fee',
            'minor_adjustment_fee', 'item_cost', 'status', 'note', 'created_at', 'completed_at',
            'driver', 'user'
        ]
        read_only_fields = ('id', 'user', 'estimated_distance_km','estimated_price', 'final_price', 'waiting_time_fee',
                          'minor_adjustment_fee', 'completed_at', 'driver')

    def validate_type(self, value):
        """Validate that the task type is one of the allowed choices"""
        valid_types = [choice[0] for choice in Task.TYPE_CHOICES]
        if value not in valid_types:
            raise ValidationError(f"Invalid task type. Must be one of: {valid_types}")
        return value

    def validate(self, attrs):
        """Validate coordinates and ensure they are provided"""
        required_fields = ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']
        for field in required_fields:
            if field not in attrs or attrs[field] is None:
                raise ValidationError(f"{field} is required")
        
        # Validate coordinate ranges
        for coord_field in ['pickup_lat', 'dropoff_lat']:
            if not -90 <= attrs[coord_field] <= 90:
                raise ValidationError(f"{coord_field} must be between -90 and 90")
        
        for coord_field in ['pickup_lng', 'dropoff_lng']:
            if not -180 <= attrs[coord_field] <= 180:
                raise ValidationError(f"{coord_field} must be between -180 and 180")
        
        return attrs


class TaskDetailSerializer(TaskSerializer):
    """More detailed serializer for individual task views"""
    
    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + [
            'arrived_at_location_at', 'waiting_started_at', 'waiting_ended_at',
            'is_price_confirmed'
        ]
        read_only_fields = TaskSerializer.Meta.read_only_fields + (
            'arrived_at_location_at', 'waiting_started_at', 'waiting_ended_at',
            'is_price_confirmed'
        )

    

class AdminTaskSerializer(TaskDetailSerializer):
    """Serializer for admin users with full access"""
    
    class Meta(TaskDetailSerializer.Meta):
        fields = '__all__'
        read_only_fields = ('id', 'created_at')

