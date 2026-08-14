"""Renders a Manifest as a PDF. Kept separate from tasks.py so it can be
unit tested (or swapped out) without touching Celery at all."""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def render_manifest_pdf(manifest) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    order = manifest.order

    elements = [
        Paragraph("ALLIANCE SUPPLY COMMAND", styles["Title"]),
        Paragraph(f"Cargo Manifest {manifest.number}", styles["Heading2"]),
        Spacer(1, 0.4 * cm),
        Paragraph(f"Deployment order: {order.number}", styles["Normal"]),
        Paragraph(f"Squadron: {order.squadron.name} ({order.squadron.callsign})", styles["Normal"]),
        Paragraph(f"Source base: {order.source_base.name} ({order.source_base.code})", styles["Normal"]),
        Paragraph(f"Issued: {manifest.issued_at:%Y-%m-%d %H:%M} UTC", styles["Normal"]),
        Spacer(1, 0.75 * cm),
    ]

    data = [["SKU", "Component", "Qty", "Unit price", "Line total"]]
    for line in order.lines.select_related("component").order_by("component__sku"):
        line_total = line.unit_price * line.quantity
        data.append(
            [
                line.component.sku,
                line.component.name,
                str(line.quantity),
                f"{line.unit_price} cr",
                f"{line_total} cr",
            ]
        )

    table = Table(data, colWidths=[3 * cm, 6 * cm, 2 * cm, 3 * cm, 3 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#182339")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f4f8")]),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(f"<b>Total value: {manifest.total_value} credits</b>", styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()
