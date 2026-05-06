from rest_framework.permissions import BasePermission

class IsTaskOwnerOrAdminOrDriver(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role == 'ADMIN':
            return True

        if obj.user == user:
            return True

        if obj.driver and obj.driver.user == user:
            return True

        return False


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.role == 'ADMIN' or obj.user == request.user

