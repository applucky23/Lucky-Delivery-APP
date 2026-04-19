from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django_fsm import FSMField, transition
import uuid


class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError('Phone number is required')
        # Generate username from phone if not provided
        if not extra_fields.get('username'):
            extra_fields['username'] = f'user_{phone_number}'
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'ADMIN')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
            
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [('USER', 'User'), ('DRIVER', 'Driver'), ('ADMIN', 'Admin')]

    supabase_uid = models.UUIDField(unique=True, null=True, blank=True)
    username = models.CharField(max_length=100, unique=True)
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='USER')
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.username


class DriverProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    full_name  = models.CharField(max_length=100)
    is_available = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    current_debt = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    debt_limit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_tasks = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_online = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    profile_image = models.URLField(null=True, blank=True)
    id_image = models.URLField(null=True, blank=True)

    def __str__(self):
        return f"Driver: {self.user.username}"

    def save(self, *args, **kwargs):
        self.is_blocked = self.current_debt >= self.debt_limit
        super().save(*args, **kwargs)


class Task(models.Model):
    TYPE_CHOICES = [('DELIVERY', 'Delivery'), ('SHOPPING', 'Shopping'), ('ERRAND', 'Errand')]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'), ('ASSIGNED', 'Assigned'), ('ARRIVED', 'Arrived'),
        ('AWAITING_APPROVAL', 'Awaiting Approval'), ('PURCHASED', 'Purchased'),
        ('DELIVERING', 'Delivering'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    driver = models.ForeignKey(DriverProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)

    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_lat = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_lng = models.DecimalField(max_digits=9, decimal_places=6)

    estimated_distance_km = models.DecimalField(max_digits=7, decimal_places=2)
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2)

    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    waiting_time_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    minor_adjustment_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    item_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    status = FSMField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    arrived_at_location_at = models.DateTimeField(null=True, blank=True)
    waiting_started_at = models.DateTimeField(null=True, blank=True)
    waiting_ended_at = models.DateTimeField(null=True, blank=True)

    is_price_confirmed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    note = models.TextField(blank=True)

    def __str__(self):
        return f"Task #{self.id} [{self.type}] - {self.status}"

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['user']),
            models.Index(fields=['driver']),
        ]

    @transition(field=status, source='PENDING', target='ASSIGNED')
    def assign_driver(self):
        pass

    @transition(field=status, source='ASSIGNED', target='ARRIVED')
    def mark_arrived(self):
        self.arrived_at_location_at = timezone.now()

    @transition(field=status, source='ARRIVED', target='AWAITING_APPROVAL')
    def request_approval(self):
        pass

    @transition(field=status, source='AWAITING_APPROVAL', target='PURCHASED')
    def approve_purchase(self):
        self.is_price_confirmed = True

    @transition(field=status, source='PURCHASED', target='DELIVERING')
    def start_delivery(self):
        pass

    @transition(field=status, source='DELIVERING', target='COMPLETED')
    def complete_task(self):
        self.completed_at = timezone.now()

    @transition(field=status, source=['PENDING', 'ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING'], target='CANCELLED')
    def cancel_task(self):
        pass


class DriverLocation(models.Model):
    driver = models.OneToOneField(DriverProfile, on_delete=models.CASCADE, related_name='location')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Location of {self.driver}"


class TaskTransaction(models.Model):
    TYPE_CHOICES = [
        ('TASK_CANCELLED', 'Task Cancelled'),
        ('ADMIN_OVERRIDE', 'Admin Override'), ('TASK_COMPLETED', 'Task Completed'),
    ]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='transactions')
    actor = models.ForeignKey(User, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    metadata = models.JSONField(default=dict,null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} on Task #{self.task_id}"


class WalletTransaction(models.Model):
    TYPE_CHOICES = [
        ('COMMISSION', 'Commission'), ('DRIVER_PAYMENT', 'Driver Payment'),
    ]

    driver = models.ForeignKey(DriverProfile, on_delete=models.CASCADE, related_name='wallet_transactions')
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} - {self.amount}"


class TaskProof(models.Model):
    TYPE_CHOICES = [('RECEIPT', 'Receipt'), ('SMS', 'SMS')]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='proofs')
    image_url = models.URLField()
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    extracted_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    driver_reported_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_flagged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.type} proof for Task #{self.task_id}"


class Rating(models.Model):
    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_given')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_received')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='ratings')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.rating}★ from {self.from_user} to {self.to_user}"

    class Meta:
        unique_together = ('from_user', 'to_user', 'task')


class Notification(models.Model):
    TYPE_CHOICES = [
        ('TASK_ASSIGNED', 'Task Assigned'), ('PRICE_UPDATE', 'Price Update'),
        ('TASK_COMPLETED', 'Task Completed'), ('PAYMENT_REQUIRED', 'Payment Required'),
        ('SYSTEM_ALERT', 'System Alert'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} → {self.user}"


class AdminAction(models.Model):
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_actions')
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True)
    driver = models.ForeignKey(DriverProfile, on_delete=models.SET_NULL, null=True, blank=True)
    action_type = models.CharField(max_length=100)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"AdminAction by {self.admin} - {self.action_type}"


class PaymentRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]

    driver = models.ForeignKey(DriverProfile, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20)
    reference = models.CharField(max_length=100, unique=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    raw_response = models.JSONField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['reference']),
        ]
