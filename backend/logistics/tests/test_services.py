import pytest

from logistics import services
from logistics.models import DeploymentOrder, Requisition, RequisitionLine, Stock, StockMovement


@pytest.mark.django_db
class TestReceiveRequisition:
    def test_happy_path_credits_stock_and_logs_movement(self, command_user, yavin_base, supplier, component):
        requisition = Requisition.objects.create(
            number="REQ-0001",
            supplier=supplier,
            destination_base=yavin_base,
            status=Requisition.Status.SUBMITTED,
            created_by=command_user,
        )
        RequisitionLine.objects.create(requisition=requisition, component=component, quantity=10, unit_cost=120)

        services.receive_requisition(requisition, performed_by=command_user)

        stock = Stock.objects.get(base=yavin_base, component=component)
        assert stock.quantity == 10

        movement = StockMovement.objects.get(reference="REQ-0001")
        assert movement.movement_type == StockMovement.MovementType.INBOUND
        assert movement.quantity == 10

        requisition.refresh_from_db()
        assert requisition.status == Requisition.Status.RECEIVED
        assert requisition.received_at is not None

    def test_wrong_status_is_rejected(self, command_user, yavin_base, supplier):
        requisition = Requisition.objects.create(
            number="REQ-0002",
            supplier=supplier,
            destination_base=yavin_base,
            status=Requisition.Status.DRAFT,
            created_by=command_user,
        )
        with pytest.raises(services.InvalidOrderStateError):
            services.receive_requisition(requisition, performed_by=command_user)


@pytest.mark.django_db
class TestDispatchOrder:
    def _confirmed_order(self, command_user, yavin_base, squadron, component, quantity):
        order = DeploymentOrder.objects.create(
            number="DEP-0001",
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.CONFIRMED,
            created_by=command_user,
        )
        order.lines.create(component=component, quantity=quantity, unit_price=component.unit_price)
        return order

    def test_happy_path_debits_stock_and_issues_manifest(
        self, command_user, yavin_base, squadron, component
    ):
        Stock.objects.create(base=yavin_base, component=component, quantity=10)
        order = self._confirmed_order(command_user, yavin_base, squadron, component, quantity=4)

        services.dispatch_order(order, performed_by=command_user)

        stock = Stock.objects.get(base=yavin_base, component=component)
        assert stock.quantity == 6

        order.refresh_from_db()
        component.refresh_from_db()  # unit_price was assigned as a raw string in the fixture
        assert order.status == DeploymentOrder.Status.DISPATCHED
        assert order.manifest.total_value == component.unit_price * 4

    def test_insufficient_stock_raises_and_changes_nothing(
        self, command_user, yavin_base, squadron, component
    ):
        Stock.objects.create(base=yavin_base, component=component, quantity=2)
        order = self._confirmed_order(command_user, yavin_base, squadron, component, quantity=5)

        with pytest.raises(services.InsufficientStockError):
            services.dispatch_order(order, performed_by=command_user)

        # nothing was applied: stock unchanged, order still CONFIRMED, no movement logged
        assert Stock.objects.get(base=yavin_base, component=component).quantity == 2
        order.refresh_from_db()
        assert order.status == DeploymentOrder.Status.CONFIRMED
        assert not StockMovement.objects.filter(reference="DEP-0001").exists()

    def test_wrong_status_is_rejected(self, command_user, yavin_base, squadron, component):
        order = DeploymentOrder.objects.create(
            number="DEP-0002",
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.DRAFT,
            created_by=command_user,
        )
        with pytest.raises(services.InvalidOrderStateError):
            services.dispatch_order(order, performed_by=command_user)

    def test_manifest_number_fits_when_order_number_is_at_max_length(
        self, command_user, yavin_base, squadron, component
    ):
        # Regression test: the manifest number is built as f"MAN-{order.number}".
        # DeploymentOrder.number allows up to 20 chars, so a full-length order
        # number used to overflow Manifest.number (also capped at 20) and
        # crash dispatch with a DB-level DataError -- caught by the e2e
        # dispatch-flow test using a realistic generated order number, not by
        # any unit test, because every fixture here used short numbers like
        # "DEP-0001". Manifest.number is now max_length=30; this locks it in.
        max_length_number = "DEP-" + "9" * 16  # exactly 20 characters
        assert len(max_length_number) == 20
        Stock.objects.create(base=yavin_base, component=component, quantity=10)
        order = DeploymentOrder.objects.create(
            number=max_length_number,
            squadron=squadron,
            source_base=yavin_base,
            status=DeploymentOrder.Status.CONFIRMED,
            created_by=command_user,
        )
        order.lines.create(component=component, quantity=1, unit_price=component.unit_price)

        services.dispatch_order(order, performed_by=command_user)

        order.refresh_from_db()
        assert order.status == DeploymentOrder.Status.DISPATCHED
        assert order.manifest.number == f"MAN-{max_length_number}"


@pytest.mark.django_db
class TestAdjustStock:
    def test_positive_adjustment(self, command_user, yavin_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=5)
        services.adjust_stock(yavin_base, component, delta=3, performed_by=command_user, reason="Stocktake")
        assert Stock.objects.get(base=yavin_base, component=component).quantity == 8

    def test_adjustment_below_zero_is_rejected(self, command_user, yavin_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=2)
        with pytest.raises(services.InsufficientStockError):
            services.adjust_stock(yavin_base, component, delta=-5, performed_by=command_user, reason="Damage")
        assert Stock.objects.get(base=yavin_base, component=component).quantity == 2


@pytest.mark.django_db
class TestTransferStock:
    def test_transfer_moves_units_and_logs_both_sides(
        self, command_user, yavin_base, hoth_base, component
    ):
        Stock.objects.create(base=yavin_base, component=component, quantity=10)

        services.transfer_stock(component, yavin_base, hoth_base, quantity=4, performed_by=command_user)

        assert Stock.objects.get(base=yavin_base, component=component).quantity == 6
        assert Stock.objects.get(base=hoth_base, component=component).quantity == 4

        reference = f"TRF-{yavin_base.code}-{hoth_base.code}-{component.sku}"
        movements = StockMovement.objects.filter(reference=reference)
        assert movements.count() == 2
        assert {m.quantity for m in movements} == {-4, 4}

    def test_transfer_more_than_available_is_rejected(self, command_user, yavin_base, hoth_base, component):
        Stock.objects.create(base=yavin_base, component=component, quantity=3)
        with pytest.raises(services.InsufficientStockError):
            services.transfer_stock(component, yavin_base, hoth_base, quantity=10, performed_by=command_user)
