"""Proves the concurrency guarantee that services.dispatch_order relies on:
select_for_update() makes a second transaction wait for the first to commit,
so two dispatches racing for the same limited stock can never both succeed
and never push Stock.quantity below zero.

Needs `transaction=True` (real TransactionTestCase semantics) because the
whole point is two separate DB connections/transactions running at the same
time -- the default django_db fixture wraps the test in one transaction that
other threads can't see into.
"""
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connections

from logistics import services
from logistics.models import DeploymentOrder, Stock


@pytest.mark.django_db(transaction=True)
def test_concurrent_dispatch_never_oversells(command_user, yavin_base, squadron, component):
    Stock.objects.create(base=yavin_base, component=component, quantity=10)

    orders = []
    for i in range(2):
        order = DeploymentOrder.objects.create(
            number=f"DEP-CONC-{i}",
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.CONFIRMED,
            created_by=command_user,
        )
        order.lines.create(component=component, quantity=6, unit_price=component.unit_price)
        orders.append(order)

    # Both orders ask for 6 units but only 10 are available -- at most one can win.
    results: dict[str, str] = {}

    def run(order):
        try:
            services.dispatch_order(order, performed_by=command_user)
            results[order.number] = "ok"
        except services.InsufficientStockError:
            results[order.number] = "rejected"
        finally:
            connections.close_all()  # each thread gets its own connection; clean it up

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(run, order) for order in orders]
        for future in futures:
            future.result()

    outcomes = list(results.values())
    assert outcomes.count("ok") == 1, f"expected exactly one dispatch to succeed, got {results}"
    assert outcomes.count("rejected") == 1

    stock = Stock.objects.get(base=yavin_base, component=component)
    assert stock.quantity == 4  # 10 - 6: applied exactly once, never negative
