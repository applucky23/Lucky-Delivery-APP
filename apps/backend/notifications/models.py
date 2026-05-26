from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# Create your models here.
class Notification(models.Model):

    class Types(models.TextChoices):
        # ─── Task offer & assignment ──────────────────────────────
        TASK_OFFER = "TASK_OFFER", "Task Offer"
        TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
        TASK_TAKEN = "TASK_TAKEN", "Task Taken"

        # ─── Task lifecycle ───────────────────────────────────────
        TASK_CANCELLED = "TASK_CANCELLED", "Task Cancelled"
        TASK_COMPLETED = "TASK_COMPLETED", "Task Completed"
        NO_DRIVERS_FOUND = "NO_DRIVERS_FOUND", "No Drivers Found"

        # ─── Task progression ─────────────────────────────────────
        DRIVER_ARRIVED = "DRIVER_ARRIVED", "Driver Arrived"
        DRIVER_ON_THE_WAY = "DRIVER_ON_THE_WAY", "Driver On The Way"

        # ─── Price flow ───────────────────────────────────────────
        PRICE_APPROVAL_REQUIRED = "PRICE_APPROVAL_REQUIRED", "Price Approval Required"
        PRICE_UPDATE = "PRICE_UPDATE", "Price Update"

        # ─── Driver onboarding ────────────────────────────────────
        DRIVER_STATUS_UPDATE = "DRIVER_STATUS_UPDATE", "Driver Status Update"

        # ─── Misc ─────────────────────────────────────────────────
        RATE_REMINDER = "RATE_REMINDER", "Rate Reminder"
        PAYMENT_REQUIRED = "PAYMENT_REQUIRED", "Payment Required"
        SYSTEM_ALERT = "SYSTEM_ALERT", "System Alert"

    user = models.ForeignKey(User,on_delete=models.CASCADE,related_name='notifications')
    type = models.CharField(max_length=50,choices=Types.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True,blank=True)
    task = models.ForeignKey("customers.Task",on_delete=models.SET_NULL,null=True,blank=True,related_name='notifications')
    data = models.JSONField(default=dict,blank=True)
    is_persistent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"{self.type} → {self.user}"


class FCMDevice(models.Model):

    class Platforms(models.TextChoices):
        ANDROID = "ANDROID", "Android"
        IOS = "IOS", "iOS"
        WEB = "WEB", "Web"

    user = models.ForeignKey(User,on_delete=models.CASCADE,related_name='fcm_devices')
    token = models.TextField(unique=True)
    platform = models.CharField(max_length=10,choices=Platforms.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['token']),
        ]

    def __str__(self):
        return f"{self.user} - {self.platform}"
