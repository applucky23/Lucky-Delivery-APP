from rest_framework.serializers import ModelSerializer, ValidationError
from rest_framework import serializers
from customers.models import Task, TaskAssignment, Rating


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
            'pickup_address', 'dropoff_address',
            'estimated_distance_km', 'estimated_price', 'final_price', 'waiting_time_fee',
            'minor_adjustment_fee', 'item_cost', 'item_size', 'priority', 'status', 'note', 'created_at', 'completed_at',
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
        """Validate coordinates and ensure they are provided (for full updates only)"""
        # Skip required field validation for partial updates
        if not self.partial:
            required_fields = ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']
            for field in required_fields:
                if field not in attrs or attrs[field] is None:
                    raise ValidationError(f"{field} is required")
        
        # Validate coordinate ranges only if coordinates are provided
        for coord_field in ['pickup_lat', 'dropoff_lat']:
            if coord_field in attrs and attrs[coord_field] is not None:
                if not -90 <= attrs[coord_field] <= 90:
                    raise ValidationError(f"{coord_field} must be between -90 and 90")
        
        for coord_field in ['pickup_lng', 'dropoff_lng']:
            if coord_field in attrs and attrs[coord_field] is not None:
                if not -180 <= attrs[coord_field] <= 180:
                    raise ValidationError(f"{coord_field} must be between -180 and 180")
        
        return attrs


class TaskDetailSerializer(TaskSerializer):
    """More detailed serializer for individual task views"""
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.SerializerMethodField()
    driver_rating = serializers.SerializerMethodField()
    driver_rating_count = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.SerializerMethodField()
    has_receipt = serializers.SerializerMethodField()

    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + [
            'arrived_at_location_at', 'arrived_at_dropoff_at', 'waiting_started_at', 'waiting_ended_at',
            'is_price_confirmed', 'driver_latitude', 'driver_longitude',
            'driver_name', 'driver_phone', 'driver_rating', 'driver_rating_count',
            'user_name', 'user_phone', 'has_receipt',
        ]
        read_only_fields = TaskSerializer.Meta.read_only_fields + (
            'arrived_at_location_at', 'arrived_at_dropoff_at', 'waiting_started_at', 'waiting_ended_at',
            'is_price_confirmed', 'driver_latitude', 'driver_longitude',
            'driver_name', 'driver_phone', 'driver_rating', 'driver_rating_count',
            'user_name', 'user_phone',
        )

    def get_driver_latitude(self, obj):
        try:
            if obj.driver:
                return float(obj.driver.location.latitude)
        except:
            pass
        return None

    def get_driver_longitude(self, obj):
        try:
            if obj.driver:
                return float(obj.driver.location.longitude)
        except:
            pass
        return None

    def get_driver_name(self, obj):
        try:
            return obj.driver.full_name
        except:
            return None

    def get_driver_phone(self, obj):
        try:
            return obj.driver.user.phone_number
        except:
            return None

    def get_driver_rating(self, obj):
        try:
            return float(obj.driver.user.rating)
        except:
            return None

    def get_driver_rating_count(self, obj):
        try:
            return obj.driver.user.rating_count
        except:
            return 0

    def get_user_name(self, obj):
        try:
            return obj.user.profile.name
        except:
            return obj.user.username

    def get_user_phone(self, obj):
        return obj.user.phone_number

    def get_has_receipt(self, obj):
        return obj.proofs.exists()

class AdminTaskSerializer(TaskDetailSerializer):
    """Serializer for admin users with full access"""
    
    class Meta(TaskDetailSerializer.Meta):
        fields = '__all__'
        read_only_fields = ('id', 'created_at')



class TaskAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for driver assignment cards — includes nested task details"""
    task = TaskDetailSerializer(read_only=True)

    class Meta:
        model = TaskAssignment
        fields = ['id', 'task', 'outcome', 'notified_at']
