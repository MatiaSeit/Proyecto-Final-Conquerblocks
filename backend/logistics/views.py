from django.conf import settings
from django.db.models import F, Sum
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services, tasks
from .models import (
    Base,
    Category,
    Component,
    DeploymentOrder,
    Manifest,
    Requisition,
    Squadron,
    Stock,
    StockMovement,
    Supplier,
)
from .permissions import IsCommandOrReadOnly, IsDispatcherOrCommand, IsQuartermasterOrCommand
from .serializers import (
    BaseSerializer,
    CategorySerializer,
    ComponentSerializer,
    DeploymentOrderSerializer,
    ManifestSerializer,
    RequisitionSerializer,
    SquadronSerializer,
    StockMovementSerializer,
    StockSerializer,
    SupplierSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsCommandOrReadOnly]


class BaseViewSet(viewsets.ModelViewSet):
    queryset = Base.objects.all()
    serializer_class = BaseSerializer
    permission_classes = [IsCommandOrReadOnly]
    filterset_fields = ["is_active"]
    search_fields = ["name", "code", "system"]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsCommandOrReadOnly]
    search_fields = ["name", "home_system"]


class SquadronViewSet(viewsets.ModelViewSet):
    queryset = Squadron.objects.all()
    serializer_class = SquadronSerializer
    permission_classes = [IsCommandOrReadOnly]
    search_fields = ["name", "callsign"]


class ComponentViewSet(viewsets.ModelViewSet):
    queryset = Component.objects.select_related("category").prefetch_related("stock_entries")
    serializer_class = ComponentSerializer
    permission_classes = [IsCommandOrReadOnly]
    filterset_fields = ["category", "is_active"]
    search_fields = ["sku", "name"]
    ordering_fields = ["sku", "name", "unit_price"]


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    """Stock is never written through the API directly -- see logistics.services."""

    queryset = Stock.objects.select_related("base", "component")
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["base", "component"]


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related("base", "component", "performed_by")
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["base", "component", "movement_type", "reference"]
    ordering_fields = ["created_at"]


class RequisitionViewSet(viewsets.ModelViewSet):
    queryset = Requisition.objects.select_related("supplier", "destination_base").prefetch_related("lines")
    serializer_class = RequisitionSerializer
    permission_classes = [IsQuartermasterOrCommand]
    filterset_fields = ["status", "supplier", "destination_base"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        requisition = self.get_object()
        requisition.status = Requisition.Status.SUBMITTED
        requisition.save(update_fields=["status"])
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        requisition = self.get_object()
        try:
            requisition = services.receive_requisition(requisition, performed_by=request.user)
        except services.InvalidOrderStateError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(self.get_serializer(requisition).data)


class DeploymentOrderViewSet(viewsets.ModelViewSet):
    queryset = DeploymentOrder.objects.select_related("squadron", "source_base").prefetch_related("lines")
    serializer_class = DeploymentOrderSerializer
    permission_classes = [IsDispatcherOrCommand]
    filterset_fields = ["status", "squadron", "source_base"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = self.get_object()
        order.status = DeploymentOrder.Status.CONFIRMED
        order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"], url_path="dispatch")
    def perform_dispatch(self, request, pk=None):
        # named perform_dispatch (not "dispatch") to avoid shadowing
        # APIView.dispatch(), which is what wraps the raw WSGIRequest into
        # a DRF Request in the first place -- naming this method "dispatch"
        # caused self.request to stay an unwrapped WSGIRequest downstream.
        order = self.get_object()
        try:
            order = services.dispatch_order(order, performed_by=request.user)
        except services.InsufficientStockError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except services.InvalidOrderStateError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(self.get_serializer(order).data)


class ManifestViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: manifests are only ever created by services.dispatch_order."""

    queryset = Manifest.objects.select_related("order__squadron", "order__source_base")
    serializer_class = ManifestSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["order"]

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """Streams the manifest PDF, rendering it fresh on every request
        instead of reading back the file the Celery task saved.

        render_manifest_pdf() is a pure function of the manifest's own DB
        data (see logistics/pdf.py), so regenerating it here costs a few
        milliseconds and sidesteps a real problem: on a free hosting tier
        the app's disk isn't guaranteed to survive a restart, so trusting
        a previously-saved file to still be there days later isn't safe.
        The saved pdf_file from the async task is still what pdf_ready
        reflects (it's proof generation succeeded at least once) -- this
        endpoint just doesn't depend on that file still existing on disk.
        """
        from .pdf import render_manifest_pdf

        manifest = self.get_object()
        if not manifest.pdf_file:
            return Response({"detail": "PDF not generated yet."}, status=status.HTTP_404_NOT_FOUND)

        pdf_bytes = render_manifest_pdf(manifest)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{manifest.number}.pdf"'
        return response


class LowStockDigestCronView(APIView):
    """Triggered by an external scheduler (see .github/workflows/) instead
    of Celery Beat -- the free deployment has no persistent worker process
    for Beat to run inside, so an hourly HTTP call replaces it. Guarded by
    a shared secret header rather than session auth since the caller is a
    cron job, not a logged-in user."""

    permission_classes = [AllowAny]

    def post(self, request):
        expected = settings.CRON_SECRET
        provided = request.headers.get("X-Cron-Secret", "")
        if not expected or provided != expected:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        result = tasks.send_low_stock_digest()
        return Response({"result": result})


class LowStockReportView(APIView):
    """Components whose total stock across all bases is at/below minimum_stock."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        components = (
            Component.objects.annotate(total_stock=Sum("stock_entries__quantity"))
            .filter(total_stock__lte=F("minimum_stock"), is_active=True)
            .values("id", "sku", "name", "total_stock", "minimum_stock")
        )
        return Response(list(components))


class InventoryValuationReportView(APIView):
    """Total inventory value (unit_cost x quantity) grouped by base."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = (
            Stock.objects.values("base__code", "base__name")
            .annotate(total_value=Sum(F("quantity") * F("component__unit_cost")))
            .order_by("base__code")
        )
        return Response(list(data))
