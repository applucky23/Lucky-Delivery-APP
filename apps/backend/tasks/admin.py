from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count, Avg, Sum
from django.utils.safestring import mark_safe
from django.urls import reverse
from django.utils import timezone
from rangefilter.filter import DateRangeFilter
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from customers.models import Task, TaskTransaction, TaskProof, TaskAssignment


class TaskResource(resources.ModelResource):
    class Meta:
        model = Task
        fields = ('id', 'user', 'driver', 'type', 'status', 'estimated_price', 'final_price', 'created_at', 'completed_at')


@admin.register(Task)
class TaskAdmin(ImportExportModelAdmin):
    resource_class = TaskResource
    list_display = (
        'id', 'task_type_badge', 'status_badge', 'customer_info', 'driver_info',
        'price_display', 'created_at', 'completion_time', 'action_buttons'
    )
    list_filter = (
        'status', 'type', ('created_at', DateRangeFilter),
        ('completed_at', DateRangeFilter), 'is_price_confirmed'
    )
    search_fields = (
        'user__username', 'user__phone_number', 'driver__user__username',
        'driver__user__phone_number', 'note', 'id'
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'completed_at', 'arrived_at_location_at')

    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'driver', 'type', 'status', 'note')
        }),
        ('Location Details', {
            'fields': ('pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng')
        }),
        ('Pricing Information', {
            'fields': (
                'estimated_price', 'final_price', 'item_cost',
                'waiting_time_fee', 'minor_adjustment_fee', 'is_price_confirmed'
            )
        }),
        ('Timestamps', {
            'fields': (
                'created_at', 'completed_at', 'arrived_at_location_at',
                'waiting_started_at', 'waiting_ended_at'
            )
        }),
    )

    def task_type_badge(self, obj):
        colors = {
            'DELIVERY': '#28a745',
            'SHOPPING': '#17a2b8',
            'ERRAND': '#ffc107'
        }
        color = colors.get(obj.type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_type_display()
        )
    task_type_badge.short_description = 'Type'

    def status_badge(self, obj):
        colors = {
            'PENDING': '#ffc107',
            'ASSIGNED': '#17a2b8',
            'ARRIVED': '#6f42c1',
            'AWAITING_APPROVAL': '#fd7e14',
            'PURCHASED': '#20c997',
            'DELIVERING': '#6610f2',
            'COMPLETED': '#28a745',
            'CANCELLED': '#dc3545'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def customer_info(self, obj):
        if obj.user:
            return format_html(
                '<strong>{}</strong><br><small style="color: #666;">{}</small>',
                obj.user.username, obj.user.phone_number
            )
        return mark_safe('<span style="color: #999;">—</span>')
    customer_info.short_description = 'Customer'
    customer_info.allow_tags = True

    def driver_info(self, obj):
        if obj.driver:
            status = '🟢' if obj.driver.is_online else '🔴'
            return format_html(
                '{} <strong>{}</strong><br><small style="color: #666;">{}</small>',
                status, obj.driver.user.username, obj.driver.user.phone_number
            )
        return mark_safe('<span style="color: #999;">Unassigned</span>')
    driver_info.short_description = 'Driver'
    driver_info.allow_tags = True

    def price_display(self, obj):
        if obj.final_price:
            return format_html(
                '<strong>${}</strong><br><small style="color: #666;">Est: ${}</small>',
                obj.final_price, obj.estimated_price or '0'
            )
        elif obj.estimated_price:
            return format_html(
                '<span style="color: #ffc107;">${}</span><br><small>Estimate</small>',
                obj.estimated_price
            )
        return mark_safe('<span style="color: #999;">—</span>')
    price_display.short_description = 'Price'
    price_display.allow_tags = True

    def completion_time(self, obj):
        if obj.completed_at and obj.created_at:
            duration = obj.completed_at - obj.created_at
            hours = duration.total_seconds() / 3600
            return format_html('<small>{:.1f}h</small>', hours)
        return mark_safe('<span style="color: #999;">—</span>')
    completion_time.short_description = 'Duration'
    completion_time.allow_tags = True

    def action_buttons(self, obj):
        if obj.status in ['PENDING', 'ASSIGNED']:
            return format_html(
                '<a href="/admin/customers/task/{}/change/" '
                'class="button" style="background: #17a2b8; color: white; '
                'padding: 3px 8px; border-radius: 3px; text-decoration: none;">Edit</a>',
                obj.id
            )
        return mark_safe('<span style="color: #999;">—</span>')
    action_buttons.short_description = 'Actions'
    action_buttons.allow_tags = True

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'driver__user')


class TaskProofResource(resources.ModelResource):
    class Meta:
        model = TaskProof
        fields = ('task', 'type', 'extracted_amount', 'driver_reported_amount', 'is_flagged', 'verified')


@admin.register(TaskProof)
class TaskProofAdmin(ImportExportModelAdmin):
    resource_class = TaskProofResource
    list_display = (
        'task_link', 'proof_type_badge', 'amount_comparison',
        'verification_status', 'created_at', 'preview_image'
    )
    list_filter = ('type', 'is_flagged', 'verified', ('created_at', DateRangeFilter))
    search_fields = ('task__id', 'task__user__username', 'task__driver__user__username')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'preview_image_admin')

    fieldsets = (
        ('Proof Information', {
            'fields': ('task', 'type', 'image_url', 'preview_image_admin')
        }),
        ('Amount Details', {
            'fields': ('extracted_amount', 'driver_reported_amount')
        }),
        ('Verification', {
            'fields': ('is_flagged', 'verified', 'verified_by')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )

    def task_link(self, obj):
        if obj.task:
            return format_html(
                '<a href="/admin/customers/task/{}/change/">#{} - {}</a>',
                obj.task.id, obj.task.id, obj.task.get_type_display()
            )
        return mark_safe('<span style="color: #999;">—</span>')
    task_link.short_description = 'Task'
    task_link.allow_tags = True

    def proof_type_badge(self, obj):
        colors = {'RECEIPT': '#28a745', 'SMS': '#17a2b8'}
        color = colors.get(obj.type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_type_display()
        )
    proof_type_badge.short_description = 'Type'
    proof_type_badge.allow_tags = True

    def amount_comparison(self, obj):
        if obj.extracted_amount and obj.driver_reported_amount:
            diff = obj.extracted_amount - obj.driver_reported_amount
            if abs(diff) < 0.01:
                return format_html(
                    '<span style="color: #28a745;">✓ ${}</span>',
                    obj.extracted_amount
                )
            else:
                return format_html(
                    '<span style="color: #dc3545;">${} vs ${}</span>',
                    obj.extracted_amount, obj.driver_reported_amount
                )
        elif obj.extracted_amount:
            return format_html('<span>${}</span>', obj.extracted_amount)
        elif obj.driver_reported_amount:
            return format_html('<span>${}</span>', obj.driver_reported_amount)
        return mark_safe('<span style="color: #999;">—</span>')
    amount_comparison.short_description = 'Amount'
    amount_comparison.allow_tags = True

    def verification_status(self, obj):
        if obj.verified:
            verified_by = obj.verified_by.username if obj.verified_by else 'Admin'
            return format_html(
                '<span style="color: #28a745;">✓ Verified by {}</span>',
                verified_by
            )
        elif obj.is_flagged:
            return mark_safe('<span style="color: #dc3545;">⚠ Flagged</span>')
        return mark_safe('<span style="color: #ffc107;">Pending</span>')
    verification_status.short_description = 'Status'
    verification_status.allow_tags = True

    def preview_image(self, obj):
        if obj.image_url:
            return format_html(
                '<a href="{}" target="_blank">📷 View</a>', obj.image_url
            )
        return mark_safe('<span style="color: #999;">—</span>')
    preview_image.short_description = 'Image'
    preview_image.allow_tags = True

    def preview_image_admin(self, obj):
        if obj.image_url:
            return format_html(
                '<img src="{}" style="max-width: 300px; max-height: 200px; '
                'border: 1px solid #ddd; border-radius: 4px;">',
                obj.image_url
            )
        return mark_safe('<span style="color: #999;">No image available</span>')
    preview_image_admin.short_description = 'Image Preview'
    preview_image_admin.allow_tags = True


@admin.register(TaskTransaction)
class TaskTransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_type', 'task_link', 'actor', 'amount', 'created_at')
    list_filter = ('type', ('created_at', DateRangeFilter))
    search_fields = ('task__id', 'actor__username', 'type')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    def transaction_type(self, obj):
        colors = {
            'TASK_CANCELLED': '#dc3545',
            'ADMIN_OVERRIDE': '#ffc107',
            'TASK_COMPLETED': '#28a745'
        }
        color = colors.get(obj.type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_type_display()
        )
    transaction_type.short_description = 'Type'
    transaction_type.allow_tags = True

    def task_link(self, obj):
        if obj.task:
            return format_html(
                '<a href="/admin/customers/task/{}/change/">#{} - {}</a>',
                obj.task.id, obj.task.id, obj.task.get_type_display()
            )
        return mark_safe('<span style="color: #999;">—</span>')
    task_link.short_description = 'Task'
    task_link.allow_tags = True


class TaskAssignmentResource(resources.ModelResource):
    class Meta:
        model = TaskAssignment
        fields = ('task', 'driver', 'outcome', 'notified_at', 'responded_at')


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(ImportExportModelAdmin):
    resource_class = TaskAssignmentResource
    list_display = (
        'task_link', 'driver_info', 'outcome_badge', 'notified_at', 
        'responded_at', 'response_time'
    )
    list_filter = (
        'outcome', ('notified_at', DateRangeFilter), 
        ('responded_at', DateRangeFilter)
    )
    search_fields = (
        'task__id', 'driver__user__username', 'driver__user__phone_number'
    )
    ordering = ('-notified_at',)
    readonly_fields = ('notified_at',)
    
    fieldsets = (
        ('Assignment Information', {
            'fields': ('task', 'driver', 'outcome')
        }),
        ('Timestamps', {
            'fields': ('notified_at', 'responded_at')
        }),
    )
    
    def task_link(self, obj):
        if obj.task:
            return format_html(
                '<a href="/admin/customers/task/{}/change/">#{} - {}</a>',
                obj.task.id, obj.task.id, obj.task.get_type_display()
            )
        return mark_safe('<span style="color: #999;">—</span>')
    task_link.short_description = 'Task'
    task_link.allow_tags = True
    
    def driver_info(self, obj):
        if obj.driver:
            status = '🟢' if obj.driver.is_online else '🔴'
            return format_html(
                '{} <strong>{}</strong><br><small style="color: #666;">{}</small>',
                status, obj.driver.user.username, obj.driver.user.phone_number
            )
        return mark_safe('<span style="color: #999;">—</span>')
    driver_info.short_description = 'Driver'
    driver_info.allow_tags = True
    
    def outcome_badge(self, obj):
        colors = {
            'PENDING': '#ffc107',
            'ACCEPTED': '#28a745',
            'REJECTED': '#dc3545',
            'LOST': '#6c757d',
            'EXPIRED': '#fd7e14'
        }
        color = colors.get(obj.outcome, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.get_outcome_display()
        )
    outcome_badge.short_description = 'Outcome'
    outcome_badge.allow_tags = True
    
    def response_time(self, obj):
        if obj.responded_at and obj.notified_at:
            duration = obj.responded_at - obj.notified_at
            minutes = duration.total_seconds() / 60
            if minutes < 1:
                return format_html('<small>{:.0f}s</small>', duration.total_seconds())
            elif minutes < 60:
                return format_html('<small>{:.1f}m</small>', minutes)
            else:
                hours = minutes / 60
                return format_html('<small>{:.1f}h</small>', hours)
        elif obj.outcome == 'PENDING':
            return format_html('<small style="color: #ffc107;">Pending</small>')
        return mark_safe('<span style="color: #999;">—</span>')
    response_time.short_description = 'Response Time'
    response_time.allow_tags = True
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('task', 'driver__user')


# Customize admin site headers
admin.site.site_header = 'Lucky Delivery Admin'
admin.site.site_title = 'Lucky Delivery'
admin.site.index_title = 'Task Management Dashboard'