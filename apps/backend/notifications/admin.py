from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from rangefilter.filter import DateRangeFilter
from .models import Notification, FCMDevice


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'event_badge', 'user', 'title', 'task_link',
        'is_read', 'is_persistent', 'created_at'
    )
    list_filter = (
        'type', 'is_read', 'is_persistent',
        ('created_at', DateRangeFilter),
    )
    search_fields = ('user__username', 'user__phone_number', 'title', 'message', 'type')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Notification Info', {
            'fields': ('user', 'type', 'title', 'message', 'task')
        }),
        ('State', {
            'fields': ('is_read', 'read_at', 'is_persistent')
        }),
        ('Payload', {
            'fields': ('data',)
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )

    def event_badge(self, obj):
        colors = {
            'TASK_OFFER':             '#17a2b8',
            'TASK_ASSIGNED':          '#28a745',
            'TASK_TAKEN':             '#6c757d',
            'TASK_CANCELLED':         '#dc3545',
            'TASK_COMPLETED':         '#28a745',
            'NO_DRIVERS_FOUND':       '#fd7e14',
            'DRIVER_ARRIVED':         '#6f42c1',
            'DRIVER_ON_THE_WAY':      '#6610f2',
            'PRICE_APPROVAL_REQUIRED':'#ffc107',
            'PRICE_UPDATE':           '#20c997',
            'DRIVER_STATUS_UPDATE':   '#17a2b8',
            'RATE_REMINDER':          '#fd7e14',
            'PAYMENT_REQUIRED':       '#dc3545',
            'SYSTEM_ALERT':           '#343a40',
            'ASSIGNMENT_CONFIRMED':   '#28a745',
        }
        color = colors.get(obj.type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.type
        )
    event_badge.short_description = 'Event'

    def task_link(self, obj):
        if obj.task:
            return format_html(
                '<a href="/admin/customers/task/{}/change/">#{}</a>',
                obj.task.id, obj.task.id
            )
        return mark_safe('<span style="color: #999;">—</span>')
    task_link.short_description = 'Task'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'task')


@admin.register(FCMDevice)
class FCMDeviceAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'platform_badge', 'is_active',
        'created_at', 'last_used_at', 'token_preview'
    )
    list_filter = ('platform', 'is_active', ('created_at', DateRangeFilter))
    search_fields = ('user__username', 'user__phone_number', 'token')
    ordering = ('-last_used_at',)
    readonly_fields = ('created_at', 'last_used_at')

    fieldsets = (
        ('Device Info', {
            'fields': ('user', 'platform', 'is_active')
        }),
        ('Token', {
            'fields': ('token',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'last_used_at')
        }),
    )

    def platform_badge(self, obj):
        colors = {
            'ANDROID': '#28a745',
            'IOS':     '#343a40',
            'WEB':     '#17a2b8',
        }
        color = colors.get(obj.platform, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_platform_display()
        )
    platform_badge.short_description = 'Platform'

    def token_preview(self, obj):
        if obj.token:
            return format_html(
                '<small style="color: #666;">{}</small>',
                obj.token[:24] + '…'
            )
        return mark_safe('<span style="color: #999;">—</span>')
    token_preview.short_description = 'Token'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')
