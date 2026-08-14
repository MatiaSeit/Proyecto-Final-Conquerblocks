from rest_framework import serializers

from .models import (
    Base,
    Category,
    Component,
    DeploymentOrder,
    DeploymentOrderLine,
    Manifest,
    Requisition,
    RequisitionLine,
    Squadron,
    Stock,
    StockMovement,
    Supplier,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "parent"]


class BaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Base
        fields = ["id", "name", "code", "system", "is_active"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "home_system", "contact_channel", "is_active"]


class SquadronSerializer(serializers.ModelSerializer):
    class Meta:
        model = Squadron
        fields = ["id", "name", "callsign", "commanding_officer"]


class ComponentSerializer(serializers.ModelSerializer):
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = Component
        fields = [
            "id", "sku", "name", "category", "unit_of_measure",
            "unit_cost", "unit_price", "minimum_stock", "is_active", "total_stock",
        ]

    def get_total_stock(self, obj: Component) -> int:
        return sum(s.quantity for s in obj.stock_entries.all())


class StockSerializer(serializers.ModelSerializer):
    component_sku = serializers.CharField(source="component.sku", read_only=True)
    base_code = serializers.CharField(source="base.code", read_only=True)

    class Meta:
        model = Stock
        fields = ["id", "base", "base_code", "component", "component_sku", "quantity"]
        read_only_fields = ["quantity"]  # quantity only ever changes through services.py


class StockMovementSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "base", "component", "movement_type", "quantity",
            "reference", "reason", "performed_by", "performed_by_username", "created_at",
        ]
        read_only_fields = fields


class RequisitionLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequisitionLine
        fields = ["id", "component", "quantity", "unit_cost"]


class RequisitionSerializer(serializers.ModelSerializer):
    lines = RequisitionLineSerializer(many=True)

    class Meta:
        model = Requisition
        fields = [
            "id", "number", "supplier", "destination_base", "status",
            "created_by", "created_at", "received_at", "lines",
        ]
        read_only_fields = ["status", "created_by", "created_at", "received_at"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        requisition = Requisition.objects.create(**validated_data)
        RequisitionLine.objects.bulk_create(
            [RequisitionLine(requisition=requisition, **line) for line in lines_data]
        )
        return requisition


class DeploymentOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeploymentOrderLine
        fields = ["id", "component", "quantity", "unit_price"]


class DeploymentOrderSerializer(serializers.ModelSerializer):
    lines = DeploymentOrderLineSerializer(many=True)

    class Meta:
        model = DeploymentOrder
        fields = [
            "id", "number", "squadron", "source_base", "status",
            "created_by", "created_at", "dispatched_at", "lines",
        ]
        read_only_fields = ["status", "created_by", "created_at", "dispatched_at"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        order = DeploymentOrder.objects.create(**validated_data)
        DeploymentOrderLine.objects.bulk_create(
            [DeploymentOrderLine(order=order, **line) for line in lines_data]
        )
        return order


class ManifestSerializer(serializers.ModelSerializer):
    pdf_ready = serializers.SerializerMethodField()
    # Always points at ManifestViewSet.pdf (regenerates on request) rather
    # than pdf_file's raw storage URL -- see the view for why.
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Manifest
        fields = [
            "id",
            "order",
            "number",
            "total_value",
            "issued_at",
            "pdf_file",
            "pdf_ready",
            "download_url",
        ]
        read_only_fields = fields

    def get_download_url(self, obj: Manifest) -> str | None:
        if not obj.pdf_file:
            return None
        request = self.context.get("request")
        path = f"/api/v1/manifests/{obj.pk}/pdf/"
        return request.build_absolute_uri(path) if request else path

    def get_pdf_ready(self, obj: Manifest) -> bool:
        # False for a little while after dispatch, until the Celery worker
        # (async, off the request/response cycle) finishes rendering it.
        return bool(obj.pdf_file)
