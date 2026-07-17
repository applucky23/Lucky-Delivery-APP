from django.db import models
from django.utils import timezone
from django_admin_geomap import GeoItem
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django_fsm import FSMField, transition
import uuid
import logging

logger = logging.getLogger(__name__)


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



class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    name = models.CharField(max_length=100)
    profile_image = models.URLField(null=True, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return f"Profile of {self.user.username}"



class DriverProfile(models.Model):
    VEHICLE_CHOICES = [
        ('MOTORCYCLE', 'Motorcycle'),
        ('BICYCLE', 'Bicycle'),
        ('CAR', 'Car'),
        ('MINI_TRUCK', 'Mini Truck'),
        ('ON_FOOT', 'On Foot'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    full_name    = models.CharField(max_length=100)
    area         = models.CharField(max_length=100, blank=True)
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_CHOICES, blank=True)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    rejection_reason = models.TextField(blank=True)
    id_image     = models.URLField(null=True, blank=True)
    face_image   = models.URLField(null=True, blank=True)
    profile_image = models.URLField(null=True, blank=True)
    is_available = models.BooleanField(default=False)
    is_verified  = models.BooleanField(default=False)
    current_debt = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    debt_limit   = models.DecimalField(max_digits=10, decimal_places=2, default=300)
    total_tasks  = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)
    balance      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_online    = models.BooleanField(default=False)
    is_blocked   = models.BooleanField(default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__original_status = self.status

    def __str__(self):
        return f"Driver: {self.user.username}"

    def save(self, *args, **kwargs):
        self.is_blocked = self.current_debt >= self.debt_limit
        self.is_verified = self.status == 'APPROVED'
        super().save(*args, **kwargs)

        if self.status != self.__original_status:
            self._send_status_notification()
            self.__original_status = self.status

    def _send_status_notification(self):
        try:
            from notifications.services.notify_service import notify_driver_approved, notify_driver_rejected
            if self.status == 'APPROVED':
                notify_driver_approved(self.user)
            elif self.status == 'REJECTED':
                notify_driver_rejected(self.user, reason=self.rejection_reason)
        except Exception:
            logger.exception('Failed to send driver status notification for user %s', self.user_id)


class Task(models.Model):
    TYPE_CHOICES = [('DELIVERY', 'Delivery'), ('SHOPPING', 'Shopping'), ('ERRAND', 'Errand')]
    PRIORITY_CHOICES = [('normal', 'Normal'), ('urgent', 'Urgent')]
    ITEM_SIZE_CHOICES = [
        ('up_to_2kg', 'Up to 2kg'),
        ('up_to_6kg', 'Up to 6kg'),
        ('up_to_10kg', 'Up to 10kg'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'), ('ASSIGNED', 'Assigned'), ('ARRIVED', 'Arrived'),
        ('AWAITING_APPROVAL', 'Awaiting Approval'), ('PURCHASED', 'Purchased'),
        ('DELIVERING', 'Delivering'), ('AWAITING_PAYMENT', 'Awaiting Payment'),
        ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    driver = models.ForeignKey(DriverProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)

    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_lat = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_lng = models.DecimalField(max_digits=9, decimal_places=6)

    pickup_address = models.CharField(max_length=500, blank=True, default='')
    dropoff_address = models.CharField(max_length=500, blank=True, default='')

    estimated_distance_km = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    estimated_duration_minutes = models.DecimalField(max_digits=7, decimal_places=1, null=True, blank=True)
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    vehicle_type = models.CharField(max_length=20,choices=DriverProfile.VEHICLE_CHOICES,null=True,blank=True,)

    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    waiting_time_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    minor_adjustment_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    item_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    status = FSMField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    arrived_at_location_at = models.DateTimeField(null=True, blank=True)
    arrived_at_dropoff_at = models.DateTimeField(null=True, blank=True)
    waiting_started_at = models.DateTimeField(null=True, blank=True)
    waiting_ended_at = models.DateTimeField(null=True, blank=True)

    is_price_confirmed = models.BooleanField(default=False)
    is_return_trip     = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    note = models.TextField(blank=True)
    item_size = models.CharField(max_length=10, choices=ITEM_SIZE_CHOICES, blank=True, null=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')

    dispatch_attempts = models.IntegerField(default=0)
    auto_dispatch_exhausted = models.BooleanField(default=False)
    auto_cancel_at = models.DateTimeField(null=True, blank=True)

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

    @transition(field=status, source=['ARRIVED', 'AWAITING_APPROVAL'], target='PURCHASED')
    def approve_purchase(self):
        self.is_price_confirmed = True

    @transition(field=status, source=['PURCHASED','ARRIVED'], target='DELIVERING')
    def start_delivery(self):
        pass

    @transition(field=status, source='DELIVERING', target='AWAITING_PAYMENT')
    def await_payment(self):
        pass

    @transition(field=status, source='AWAITING_PAYMENT', target='COMPLETED')
    def complete_task(self):
        self.completed_at = timezone.now()

    @transition(field=status, source=['PENDING', 'ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING', 'AWAITING_PAYMENT'], target='CANCELLED')
    def cancel_task(self):
        pass


class TaskAssignment(models.Model):
    OUTCOME_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('LOST', 'Lost'),
        ('EXPIRED', 'Expired'),
    ]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    driver = models.ForeignKey(DriverProfile, on_delete=models.CASCADE, related_name='assignments')
    outcome = models.CharField(max_length=10, choices=OUTCOME_CHOICES, default='PENDING')
    notified_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('task', 'driver')
        indexes = [
            models.Index(fields=['task', 'outcome']),  # fast lookup for "all pending for this task"
            models.Index(fields=['driver', 'outcome']), # fast lookup for "driver's active assignments"
        ]

    def __str__(self):
        return f"Task #{self.task_id} → {self.driver} [{self.outcome}]"


class DriverLocation(models.Model, GeoItem):
    driver = models.OneToOneField(DriverProfile, on_delete=models.CASCADE, related_name='location')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Location of {self.driver}"

    # These properties are REQUIRED by django_admin_geomap
    @property
    def geomap_longitude(self):
        return str(self.longitude)

    @property
    def geomap_latitude(self):
        return str(self.latitude)

    # This shows the driver's name when you click the map pin
    @property
    def geomap_popup_view(self):
        return f"<strong>Driver:</strong> {self.driver.user.username}"


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
        ('COMMISSION', 'Commission'), ('EARNING', 'Earning'), ('DRIVER_PAYMENT', 'Driver Payment'),
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
    image_url = models.URLField(max_length=2000)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    extracted_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    driver_reported_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_flagged = models.BooleanField(default=False)
    ocr_failed = models.BooleanField(default=False)
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


class CommissionPayment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('CONFIRMED', 'Confirmed'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    driver      = models.ForeignKey(DriverProfile, on_delete=models.CASCADE, related_name='commission_payments')
    amount      = models.DecimalField(max_digits=10, decimal_places=2)
    method      = models.CharField(max_length=10)          # TELEBIRR or CBE
    reference   = models.CharField(max_length=100)
    screenshot  = models.URLField(null=True, blank=True)
    note        = models.TextField(blank=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    admin_note  = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.driver} - {self.amount} [{self.status}]"
