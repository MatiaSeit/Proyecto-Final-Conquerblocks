from django.contrib import admin

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


class RequisitionLineInline(admin.TabularInline):
    model = RequisitionLine
    extra = 1


class DeploymentOrderLineInline(admin.TabularInline):
    model = DeploymentOrderLine
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "parent"]
    search_fields = ["name"]


@admin.register(Base)
class BaseAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "system", "is_active"]
    search_fields = ["code", "name", "system"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "home_system", "is_active"]
    search_fields = ["name"]


@admin.register(Squadron)
class SquadronAdmin(admin.ModelAdmin):
    list_display = ["callsign", "name", "commanding_officer"]
    search_fields = ["name", "callsign"]


@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    list_display = ["sku", "name", "category", "unit_price", "minimum_stock", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["sku", "name"]


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ["component", "base", "quantity"]
    list_filter = ["base"]
    search_fields = ["component__sku", "component__name"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["created_at", "movement_type", "component", "base", "quantity", "reference", "performed_by"]
    list_filter = ["movement_type", "base"]
    search_fields = ["reference", "component__sku"]
    readonly_fields = [f.name for f in StockMovement._meta.fields]

    def has_change_permission(self, request, obj=None):
        return False  # append-only ledger


@admin.register(Requisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ["number", "supplier", "destination_base", "status", "created_at"]
    list_filter = ["status", "destination_base"]
    inlines = [RequisitionLineInline]


@admin.register(DeploymentOrder)
class DeploymentOrderAdmin(admin.ModelAdmin):
    list_display = ["number", "squadron", "source_base", "status", "created_at"]
    list_filter = ["status", "source_base"]
    inlines = [DeploymentOrderLineInline]


@admin.register(Manifest)
class ManifestAdmin(admin.ModelAdmin):
    list_display = ["number", "order", "total_value", "issued_at"]
