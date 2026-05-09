from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, DriverProfile, UserProfile


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
    list_display = ('user', 'full_name', 'area', 'vehicle_type', 'status', 'is_available', 'is_verified', 'is_online', 'is_blocked', 'total_tasks')
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

    readonly_fields = ('email', 'created_at', 'is_blocked', 'id_image_preview', 'face_image_preview')

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
