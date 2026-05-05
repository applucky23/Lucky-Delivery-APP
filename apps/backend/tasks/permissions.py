from rest_framework.permissions import BasePermission
from customers.models import TaskAssignment

class IsTaskOwnerOrAdminOrDriver(BasePermission):
    """
    Allows access to task owner, admin, or the assigned driver.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role == 'ADMIN':
            return True

        if obj.user == user:
            return True

        if obj.driver and obj.driver.user == user:
            return True

        # Driver with a PENDING assignment (pre-acceptance)
        if user.role == 'DRIVER':
            try:
                return TaskAssignment.objects.filter(
                    task=obj,
                    driver=user.driver_profile,
                    outcome='PENDING'
                ).exists()
            except Exception:
                return False
        return False


class IsOwnerOrAdmin(BasePermission):
    """
    Allows access only to object owner or admin.
    """
    def has_object_permission(self, request, view, obj):
        return request.user.role == 'ADMIN' or obj.user == request.user


class IsAdminUser(BasePermission):
    """
    Allows access only to admin users.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'ADMIN'


class IsDriver(BasePermission):
    """
    Allows access only to driver users.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'DRIVER'
