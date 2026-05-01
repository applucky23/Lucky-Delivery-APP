from rest_framework.permissions import BasePermission
from customers.models import TaskAssignment

class IsTaskOwnerOrAdminOrDriver(BasePermission):
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
    def has_object_permission(self, request, view, obj):
        return request.user.role == 'ADMIN' or obj.user == request.user

