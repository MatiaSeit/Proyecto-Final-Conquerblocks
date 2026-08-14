"""Celery tasks run with CELERY_TASK_ALWAYS_EAGER=True in tests (see
config/settings/test.py) -- no broker or worker needed, .delay() just runs
the function inline. The manifest-PDF test still needs transaction=True:
services.dispatch_order enqueues it via transaction.on_commit, which only
fires on a real commit."""
import pytest
from django.core import mail

from logistics import services
from logistics.models import DeploymentOrder, Manifest, Stock
from logistics.tasks import send_low_stock_digest


@pytest.mark.django_db(transaction=True)
def test_dispatch_order_triggers_manifest_pdf_generation(command_user, yavin_base, squadron, component):
    Stock.objects.create(base=yavin_base, component=component, quantity=10)
    order = DeploymentOrder.objects.create(
        number="DEP-PDF-1",
        squadron=squadron,
        source_base=yavin_base,
        status=DeploymentOrder.Status.CONFIRMED,
        created_by=command_user,
    )
    order.lines.create(component=component, quantity=2, unit_price=component.unit_price)

    services.dispatch_order(order, performed_by=command_user)

    manifest = Manifest.objects.get(order=order)
    assert manifest.pdf_file.name, "expected the eagerly-run Celery task to have attached a PDF"
    assert manifest.pdf_file.name.endswith(".pdf")


@pytest.mark.django_db
class TestLowStockDigest:
    def test_sends_email_listing_components_below_minimum(self, command_user, yavin_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=1)  # minimum_stock=5

        result = send_low_stock_digest()

        assert len(mail.outbox) == 1
        assert component.sku in mail.outbox[0].body
        assert "1/5" in mail.outbox[0].body
        assert "Sent digest for 1" in result

    def test_sends_nothing_when_everything_is_above_minimum(self, command_user, yavin_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=999)

        send_low_stock_digest()

        assert len(mail.outbox) == 0
