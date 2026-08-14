from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User


class IsCommandOrReadOnly(BasePermission):
    """Only Alliance Command can create/edit master data (bases, suppliers,
    components, squadrons). Everyone authenticated can read it."""

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.role == User.Role.COMMAND)


class IsQuartermasterOrCommand(BasePermission):
    """Requisitions are managed by Quartermasters (or Command)."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.QUARTERMASTER, User.Role.COMMAND}
        )


class IsDispatcherOrCommand(BasePermission):
    """Deployment orders are managed by Dispatch Officers (or Command)."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.DISPATCHER, User.Role.COMMAND}
        )
