from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Alliance personnel. Role drives permissions across the logistics API."""

    class Role(models.TextChoices):
        COMMAND = "COMMAND", "Alliance Command"          # full access / admin
        QUARTERMASTER = "QUARTERMASTER", "Quartermaster"  # manages requisitions, suppliers, bases
        TECHNICIAN = "TECHNICIAN", "Base Technician"       # receives stock, records movements
        DISPATCHER = "DISPATCHER", "Dispatch Officer"      # creates deployment orders for squadrons

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TECHNICIAN)
    assigned_base = models.ForeignKey(
        "logistics.Base",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="personnel",
        help_text="Base this user primarily operates from (optional for COMMAND).",
    )

    def __str__(self) -> str:
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
