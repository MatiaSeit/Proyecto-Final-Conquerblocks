from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet)
router.register("bases", views.BaseViewSet)
router.register("suppliers", views.SupplierViewSet)
router.register("squadrons", views.SquadronViewSet)
router.register("components", views.ComponentViewSet)
router.register("stock", views.StockViewSet)
router.register("stock-movements", views.StockMovementViewSet)
router.register("requisitions", views.RequisitionViewSet)
router.register("deployment-orders", views.DeploymentOrderViewSet)
router.register("manifests", views.ManifestViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("reports/low-stock/", views.LowStockReportView.as_view(), name="report-low-stock"),
    path(
        "reports/inventory-valuation/",
        views.InventoryValuationReportView.as_view(),
        name="report-inventory-valuation",
    ),
    path(
        "internal/run-low-stock-digest/",
        views.LowStockDigestCronView.as_view(),
        name="internal-low-stock-digest",
    ),
]
