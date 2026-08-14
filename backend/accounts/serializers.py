from rest_framework import serializers

from .models import User


class MeSerializer(serializers.ModelSerializer):
    assigned_base_code = serializers.CharField(source="assigned_base.code", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "role", "assigned_base", "assigned_base_code"]
