"""Async side-effects. Kept out of services.py on purpose: services.py is
the source of truth for stock correctness and has to work with or without a
Celery worker running (tests, seed_demo, management commands); these tasks
are best-effort extras layered on top of it."""
import logging

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.db.models import F, Sum

logger = logging.getLogger(__name__)


@shared_task
def send_low_stock_digest():
    """Periodic (hourly, see CELERY_BEAT_SCHEDULE) email listing every
    component whose total stock across all bases is at or below its
    minimum. Sends nothing when there's nothing to report."""
    from .models import Component

    low_components = list(
        Component.objects.annotate(total_stock=Sum("stock_entries__quantity"))
        .filter(total_stock__lte=F("minimum_stock"), is_active=True)
        .order_by("sku")
    )

    if not low_components:
        return "No components below minimum -- nothing to send."

    lines = [f"- {c.sku} {c.name}: {c.total_stock or 0}/{c.minimum_stock}" for c in low_components]
    body = "Components at or below minimum stock:\n\n" + "\n".join(lines)

    send_mail(
        subject=f"[Alliance Supply Command] Low stock digest ({len(low_components)} components)",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.ALLIANCE_COMMAND_EMAIL],
    )
    return f"Sent digest for {len(low_components)} components"


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def generate_manifest_pdf(self, manifest_id: int):
    """Renders and attaches the cargo manifest PDF. Triggered from
    services.dispatch_order via transaction.on_commit -- by the time this
    runs, the Manifest row is guaranteed to be committed and visible, even
    though the worker is a separate process with its own DB connection."""
    from .models import Manifest
    from .pdf import render_manifest_pdf

    try:
        manifest = Manifest.objects.select_related(
            "order__squadron", "order__source_base"
        ).get(pk=manifest_id)
    except Manifest.DoesNotExist:
        # Shouldn't happen -- services.dispatch_order only enqueues this via
        # transaction.on_commit, once the Manifest row is guaranteed committed.
        logger.warning("generate_manifest_pdf: Manifest %s does not exist", manifest_id)
        return f"Manifest {manifest_id} not found -- skipped"

    try:
        pdf_bytes = render_manifest_pdf(manifest)
        manifest.pdf_file.save(f"{manifest.number}.pdf", ContentFile(pdf_bytes), save=True)
    except Exception as exc:  # transient rendering/storage failure -- retry a few times
        logger.exception("generate_manifest_pdf failed for %s, retrying", manifest.number)
        raise self.retry(exc=exc) from exc

    return f"Generated PDF for {manifest.number}"
