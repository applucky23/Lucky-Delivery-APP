import logging
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.html import format_html
from django.utils import timezone
from django.urls import reverse

logger = logging.getLogger(__name__)
from django.db.models import F
from .models import User, DriverProfile, UserProfile, DriverLocation, CommissionPayment, WalletTransaction, Rating
from django_admin_geomap import ModelAdmin as GeoModelAdmin


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('phone_number', 'username', 'role', 'is_staff', 'is_active', 'created_at')
    list_filter = ('role', 'is_staff', 'is_active', 'created_at')
    search_fields = ('phone_number', 'username', 'email')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {'fields': ('phone_number', 'username', 'password')}),
        ('Personal info', {'fields': ('email', 'supabase_uid')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at')}),
        ('Stats', {'fields': ('rating', 'rating_count')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'username', 'password1', 'password2', 'role'),
        }),
    )
    
    readonly_fields = ('created_at', 'last_login')


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'full_name', 'area', 'vehicle_type', 'status', 'is_available', 'is_verified', 'is_online', 'is_blocked', 'total_tasks')
    list_editable = ('is_blocked',)
    list_filter = ('status', 'is_available', 'is_verified', 'is_online', 'is_blocked', 'vehicle_type', 'created_at')
    search_fields = ('user__phone_number', 'user__username', 'full_name', 'area')
    ordering = ('-created_at',)

    fieldsets = (
        ('Driver Info', {'fields': ('user', 'full_name', 'area', 'vehicle_type', 'status', 'rejection_reason', 'is_available', 'is_verified', 'is_online')}),
        ('Contact', {'fields': ('email',)}),
        ('Financial', {'fields': ('current_debt', 'debt_limit', 'is_blocked')}),
        ('Stats', {'fields': ('total_tasks',)}),
        ('Documents & Verification', {'fields': ('id_image_preview', 'face_image_preview', 'profile_image')}),
        ('Dates', {'fields': ('created_at',)}),
    )

    readonly_fields = ('email', 'created_at', 'id_image_preview', 'face_image_preview')

    def email(self, obj):
        return obj.user.email
    email.short_description = 'Email'

    def id_image_preview(self, obj):
        if obj.id_image:
            return format_html(
                '<a href="{url}" target="_blank">'
                '<img src="{url}" style="max-width:300px; max-height:200px; '
                'border-radius:8px; border:1px solid #ddd;"/>'
                '</a><br><small style="color:#666;">{url}</small>',
                url=obj.id_image
            )
        return '—'
    id_image_preview.short_description = 'ID Card'

    def face_image_preview(self, obj):
        if obj.face_image:
            return format_html(
                '<a href="{url}" target="_blank">'
                '<img src="{url}" style="max-width:200px; max-height:200px; '
                'border-radius:50%; border:2px solid #22c55e;"/>'
                '</a><br><small style="color:#666;">{url}</small>',
                url=obj.face_image
            )
        return '—'
    face_image_preview.short_description = 'Face Photo'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'email', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('user__phone_number', 'user__username', 'name', 'user__email')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('User Info', {'fields': ('user', 'name')}),
        ('Contact', {'fields': ('email',)}),
        ('Details', {'fields': ('address', 'profile_image')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
    
    readonly_fields = ('email','created_at', 'updated_at')
    
    def email(self, obj):
        return obj.user.email
    email.short_description = 'Email'
    
    def get_search_results(self, request, queryset, search_term):
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)
        if search_term:
            queryset |= self.model.objects.filter(user__email__icontains=search_term)
        return queryset, use_distinct


@admin.register(DriverLocation)
class DriverLocationAdmin(GeoModelAdmin):
    # Standard Admin Settings
    list_display = ('driver', 'latitude', 'longitude', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('driver__user__phone_number', 'driver__user__username', 'driver__full_name')
    ordering = ('-updated_at',)
    readonly_fields = ('updated_at',)

    fieldsets = (
        ('Location Info', {'fields': ('driver', 'latitude', 'longitude')}),
        ('Timestamps', {'fields': ('updated_at',)}),
    )

    # Geomap Configuration
    geomap_show_map_on_list = True  # Shows map with markers for all rows
    geomap_show_map_on_edit = True  # Shows map when editing a single driver
    geomap_auto_center = True
    geomap_default_zoom = 13

    # Default center (Addis Ababa) if no markers exist
    geomap_default_longitude = "38.7578"  # Must be a string
    geomap_default_latitude = "9.0192"  # Must be a string

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('driver__user')


@admin.register(CommissionPayment)
class CommissionPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'driver_link', 'amount', 'method', 'reference', 'screenshot_link', 'status', 'created_at', 'reviewed_at')
    list_filter = ('status', 'method', 'created_at')
    search_fields = ('driver__user__phone_number', 'driver__user__username', 'driver__full_name', 'reference')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'reviewed_at', 'reviewed_by', 'screenshot_preview')
    actions = ['confirm_payments', 'reject_payments']

    fieldsets = (
        ('Driver Info', {'fields': ('driver', 'amount', 'method', 'reference', 'status')}),
        ('Review', {'fields': ('admin_note', 'reviewed_by', 'reviewed_at')}),
        ('Files', {'fields': ('screenshot', 'screenshot_preview')}),
        ('Driver Note', {'fields': ('note',)}),
        ('Timestamps', {'fields': ('created_at',)}),
    )

    def driver_link(self, obj):
        return format_html('<a href="{}">{}</a>',
            reverse('admin:customers_driverprofile_change', args=[obj.driver.id]),
            obj.driver.full_name or obj.driver.user.phone_number)
    driver_link.short_description = 'Driver'

    def screenshot_link(self, obj):
        if obj.screenshot:
            return format_html('<a href="{}" target="_blank">View</a>', obj.screenshot)
        return '—'
    screenshot_link.short_description = 'Screenshot'

    def screenshot_preview(self, obj):
        if obj.screenshot:
            return format_html(
                '<img src="{}" style="max-width: 300px; max-height: 200px; '
                'border: 1px solid #ddd; border-radius: 4px;">',
                obj.screenshot
            )
        return format_html('<span style="color: #999;">No screenshot uploaded</span>')
    screenshot_preview.short_description = 'Preview'

    def _reduce_debt(self, payment, user):
        driver = payment.driver
        DriverProfile.objects.filter(id=driver.id).update(
            current_debt=F('current_debt') - payment.amount
        )
        logger.info(f'Reduced debt for driver #{driver.id} by {payment.amount}')
        WalletTransaction.objects.create(
            driver=driver,
            type='DRIVER_PAYMENT',
            amount=payment.amount,
            description=f'Commission payment confirmed - ref: {payment.reference}'
        )
        return driver

    def save_model(self, request, obj, form, change):
        if change:
            old = self.model.objects.get(pk=obj.pk)
            if old.status != 'CONFIRMED' and obj.status == 'CONFIRMED':
                self._reduce_debt(obj, request.user)
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)

    def confirm_payments(self, request, queryset):
        count = 0
        for payment in queryset.filter(status='PENDING'):
            self._reduce_debt(payment, request.user)
            payment.status = 'CONFIRMED'
            payment.reviewed_by = request.user
            payment.reviewed_at = timezone.now()
            payment.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
            count += 1
        self.message_user(request, f'{count} payment(s) confirmed and debt reduced.', messages.SUCCESS)
    confirm_payments.short_description = 'Confirm selected payments'

    def reject_payments(self, request, queryset):
        if 'apply' in request.POST:
            reason = request.POST.get('admin_note', '')
            count = 0
            for payment in queryset.filter(status='PENDING'):
                payment.status = 'REJECTED'
                payment.admin_note = reason
                payment.reviewed_by = request.user
                payment.reviewed_at = timezone.now()
                payment.save(update_fields=['status', 'admin_note', 'reviewed_by', 'reviewed_at'])
                count += 1
            self.message_user(request, f'{count} payment(s) rejected.', messages.WARNING)
            return HttpResponseRedirect(request.get_full_path())

        return render(request, 'admin/commission_payment_reject.html', {
            'payments': queryset.filter(status='PENDING'),
            'action': 'reject_payments',
            'opts': self.model._meta,
        })
    reject_payments.short_description = 'Reject selected payments'


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('id', 'task_link', 'from_user', 'to_user', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('task__id', 'from_user__username', 'to_user__username',
                     'from_user__phone_number', 'to_user__phone_number')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    fieldsets = (
        ('Task', {'fields': ('task',)}),
        ('Users', {'fields': ('from_user', 'to_user')}),
        ('Rating', {'fields': ('rating', 'comment')}),
        ('Timestamps', {'fields': ('created_at',)}),
    )

    def task_link(self, obj):
        if obj.task:
            return format_html(
                '<a href="/admin/customers/task/{}/change/">#{} - {}</a>',
                obj.task.id, obj.task.id, obj.task.get_type_display()
            )
        return '—'
    task_link.short_description = 'Task'
    task_link.allow_tags = True
