from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Alliance assignment", {"fields": ("role", "assigned_base")}),
    )
    list_display = ["username", "email", "role", "assigned_base", "is_staff"]
    list_filter = DjangoUserAdmin.list_filter + ("role",)
