from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, DriverProfile


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
    list_display = ('user', 'is_available', 'is_verified', 'is_online', 'is_blocked', 'current_debt', 'total_tasks')
    list_filter = ('is_available', 'is_verified', 'is_online', 'is_blocked', 'created_at')
    search_fields = ('user__phone_number', 'user__username')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Driver Info', {'fields': ('user', 'is_available', 'is_verified', 'is_online')}),
        ('Financial', {'fields': ('current_debt', 'debt_limit', 'is_blocked')}),
        ('Stats', {'fields': ('total_tasks',)}),
        ('Documents', {'fields': ('profile_image', 'id_image')}),
        ('Dates', {'fields': ('created_at',)}),
    )
    
    readonly_fields = ('created_at', 'is_blocked')
