from django.db import models
from django.utils import timezone
import random


class Customer(models.Model):
    phone = models.CharField(max_length=20, unique=True)
    name  = models.CharField(max_length=100, blank=True)
    email = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.phone


class OTP(models.Model):
    phone      = models.CharField(max_length=20)
    code       = models.CharField(max_length=4)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used    = models.BooleanField(default=False)

    def is_expired(self):
        return (timezone.now() - self.created_at).seconds > 300  # 5 min

    @staticmethod
    def generate_code():
        return str(random.randint(1000, 9999))

    def __str__(self):
        return f"{self.phone} — {self.code}"
