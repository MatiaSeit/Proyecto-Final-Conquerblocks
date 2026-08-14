"""Covers the two endpoints that only exist because of the free-tier
deployment (see config/settings/prod.py and README > Despliegue):
  - ManifestViewSet.pdf: regenerates the manifest PDF on request instead of
    trusting a previously-saved file, since the free host's disk isn't
    guaranteed to survive a restart.
  - LowStockDigestCronView: an HTTP-triggerable stand-in for Celery Beat,
    called hourly by a GitHub Actions cron in production.
Both are plain Django/DRF views, so they're exercised the same way whether
or not CELERY_TASK_ALWAYS_EAGER is on -- nothing here is prod-specific.
"""
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from logistics import services
from logistics.models import DeploymentOrder, Manifest, Stock


@pytest.mark.django_db(transaction=True)
class TestManifestPdfEndpoint:
    def test_returns_pdf_bytes_for_a_generated_manifest(self, command_user, yavin_base, squadron, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=10)
        order = DeploymentOrder.objects.create(
            number="DEP-PDF-EP-1",
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.CONFIRMED,
            created_by=command_user,
        )
        order.lines.create(component=component, quantity=2, unit_price=component.unit_price)
        services.dispatch_order(order, performed_by=command_user)
        manifest = Manifest.objects.get(order=order)

        client = APIClient()
        client.force_authenticate(command_user)
        response = client.get(f"/api/v1/manifests/{manifest.id}/pdf/")

        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
        body = b"".join(response.streaming_content) if response.streaming else response.content
        assert body[:5] == b"%PDF-"

    def test_404_before_the_pdf_has_ever_been_generated(self, command_user, yavin_base, squadron, component):
        order = DeploymentOrder.objects.create(
            number="DEP-PDF-EP-2",
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.DISPATCHED,
            created_by=command_user,
        )
        # Built directly, bypassing services.dispatch_order, so pdf_file
        # stays empty -- the state the endpoint should treat as "not ready".
        manifest = Manifest.objects.create(order=order, number="MAN-DEP-PDF-EP-2", total_value="0.00")

        client = APIClient()
        client.force_authenticate(command_user)
        response = client.get(f"/api/v1/manifests/{manifest.id}/pdf/")

        assert response.status_code == 404


@pytest.mark.django_db
class TestLowStockDigestCronEndpoint:
    def test_rejects_requests_without_the_shared_secret(self):
        client = APIClient()
        response = client.post("/api/v1/internal/run-low-stock-digest/")
        assert response.status_code == 403

    def test_rejects_requests_with_the_wrong_secret(self):
        with override_settings(CRON_SECRET="correct-horse-battery-staple"):
            client = APIClient()
            response = client.post(
                "/api/v1/internal/run-low-stock-digest/", HTTP_X_CRON_SECRET="wrong-guess"
            )
        assert response.status_code == 403

    def test_accepts_requests_with_the_correct_secret(self, command_user, yavin_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=1)  # below minimum_stock=5

        with override_settings(CRON_SECRET="correct-horse-battery-staple"):
            client = APIClient()
            response = client.post(
                "/api/v1/internal/run-low-stock-digest/", HTTP_X_CRON_SECRET="correct-horse-battery-staple"
            )

        assert response.status_code == 200
