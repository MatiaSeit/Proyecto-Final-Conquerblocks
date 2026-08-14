"""Business logic for stock movements.

This is the layer that keeps the domain "a prueba de balas": every function
here runs inside a single DB transaction, locks the Stock rows it touches
with SELECT ... FOR UPDATE, and writes an immutable StockMovement for every
unit that moves. Views/serializers never touch Stock.quantity directly --
they call into this module instead, which is what keeps two concurrent
requests from ever pushing stock below zero.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from . import tasks
from .models import (
    Base,
    Component,
    DeploymentOrder,
    Manifest,
    Requisition,
    Stock,
    StockMovement,
)


class InsufficientStockError(Exception):
    """Raised when a dispatch/transfer would push Stock.quantity below zero."""


class InvalidOrderStateError(Exception):
    """Raised when an operation is attempted on an order in the wrong status."""


def _locked_stock(base: Base, component: Component) -> Stock:
    """Get (or create) the Stock row for base+component, locked for the
    duration of the current transaction. Must be called inside
    transaction.atomic()."""
    stock, _ = Stock.objects.select_for_update().get_or_create(
        base=base, component=component, defaults={"quantity": 0}
    )
    return stock


@transaction.atomic
def receive_requisition(requisition: Requisition, performed_by) -> Requisition:
    """Mark a Requisition as received and credit stock at its destination base.

    Locking order: lines are processed sorted by component_id, so two
    requisitions touching overlapping components always acquire row locks in
    the same order and can't deadlock each other.
    """
    if requisition.status != Requisition.Status.SUBMITTED:
        raise InvalidOrderStateError(
            f"Requisition {requisition.number} is {requisition.status}, expected SUBMITTED"
        )

    for line in requisition.lines.select_related("component").order_by("component_id"):
        stock = _locked_stock(requisition.destination_base, line.component)
        stock.quantity += line.quantity
        stock.save(update_fields=["quantity"])

        StockMovement.objects.create(
            base=requisition.destination_base,
            component=line.component,
            movement_type=StockMovement.MovementType.INBOUND,
            quantity=line.quantity,
            reference=requisition.number,
            reason=f"Requisition received from {requisition.supplier.name}",
            performed_by=performed_by,
        )

    requisition.status = Requisition.Status.RECEIVED
    requisition.received_at = timezone.now()
    requisition.save(update_fields=["status", "received_at"])
    return requisition


@transaction.atomic
def dispatch_order(order: DeploymentOrder, performed_by) -> DeploymentOrder:
    """Confirm and dispatch a DeploymentOrder: validate stock, debit it
    atomically, log the movements and issue the cargo Manifest.

    Every line is validated *and* applied inside the same locked transaction,
    so a second request racing to dispatch overlapping stock either waits for
    this one to finish or sees the updated quantity -- it can never both
    succeed and leave Stock negative.
    """
    if order.status != DeploymentOrder.Status.CONFIRMED:
        raise InvalidOrderStateError(f"Order {order.number} is {order.status}, expected CONFIRMED")

    lines = list(order.lines.select_related("component").order_by("component_id"))

    locked_stocks = {}
    for line in lines:
        stock = _locked_stock(order.source_base, line.component)
        if stock.quantity < line.quantity:
            raise InsufficientStockError(
                f"Not enough {line.component.sku} at {order.source_base.code}: "
                f"have {stock.quantity}, need {line.quantity}"
            )
        locked_stocks[line.component_id] = stock

    total_value = Decimal("0.00")
    for line in lines:
        stock = locked_stocks[line.component_id]
        stock.quantity -= line.quantity
        stock.save(update_fields=["quantity"])

        StockMovement.objects.create(
            base=order.source_base,
            component=line.component,
            movement_type=StockMovement.MovementType.OUTBOUND,
            quantity=-line.quantity,
            reference=order.number,
            reason=f"Dispatched to squadron {order.squadron.callsign}",
            performed_by=performed_by,
        )
        total_value += line.unit_price * line.quantity

    order.status = DeploymentOrder.Status.DISPATCHED
    order.dispatched_at = timezone.now()
    order.save(update_fields=["status", "dispatched_at"])

    manifest = Manifest.objects.create(
        order=order,
        number=f"MAN-{order.number}",
        total_value=total_value,
    )
    # Deferred until the transaction actually commits: enqueueing before that
    # would let the Celery worker (a separate process/connection) try to
    # fetch a Manifest row it can't see yet.
    transaction.on_commit(lambda: tasks.generate_manifest_pdf.delay(manifest.id))

    return order


@transaction.atomic
def adjust_stock(base: Base, component: Component, delta: int, performed_by, reason: str) -> Stock:
    """Manual correction (stocktake, damage, loss). `delta` can be negative."""
    stock = _locked_stock(base, component)
    new_quantity = stock.quantity + delta
    if new_quantity < 0:
        raise InsufficientStockError(
            f"Adjustment would leave {component.sku} at {base.code} negative "
            f"({stock.quantity} {delta:+d})"
        )
    stock.quantity = new_quantity
    stock.save(update_fields=["quantity"])

    StockMovement.objects.create(
        base=base,
        component=component,
        movement_type=StockMovement.MovementType.ADJUSTMENT,
        quantity=delta,
        reason=reason,
        performed_by=performed_by,
    )
    return stock


@transaction.atomic
def transfer_stock(
    component: Component, from_base: Base, to_base: Base, quantity: int, performed_by, reason: str = ""
) -> None:
    """Move stock of a single component between two bases as one atomic unit.

    Locks are acquired in a fixed order (by base id) regardless of which base
    is "from" and which is "to", so two transfers running in opposite
    directions between the same pair of bases can't deadlock each other.
    """
    if quantity <= 0:
        raise ValueError("Transfer quantity must be positive")

    first_base, second_base = sorted([from_base, to_base], key=lambda b: b.pk)
    _locked_stock(first_base, component)
    _locked_stock(second_base, component)

    source_stock = _locked_stock(from_base, component)
    if source_stock.quantity < quantity:
        raise InsufficientStockError(
            f"Not enough {component.sku} at {from_base.code}: have {source_stock.quantity}, need {quantity}"
        )

    source_stock.quantity -= quantity
    source_stock.save(update_fields=["quantity"])

    dest_stock = _locked_stock(to_base, component)
    dest_stock.quantity += quantity
    dest_stock.save(update_fields=["quantity"])

    reference = f"TRF-{from_base.code}-{to_base.code}-{component.sku}"
    StockMovement.objects.create(
        base=from_base,
        component=component,
        movement_type=StockMovement.MovementType.TRANSFER,
        quantity=-quantity,
        reference=reference,
        reason=reason or f"Transfer to {to_base.code}",
        performed_by=performed_by,
    )
    StockMovement.objects.create(
        base=to_base,
        component=component,
        movement_type=StockMovement.MovementType.TRANSFER,
        quantity=quantity,
        reference=reference,
        reason=reason or f"Transfer from {from_base.code}",
        performed_by=performed_by,
    )
