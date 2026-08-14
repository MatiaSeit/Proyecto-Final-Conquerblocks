from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Category(models.Model):
    """Component category. Self-referential so subcategories are possible
    (e.g. 'Starfighter Parts' -> 'X-wing Astromech Sockets')."""

    name = models.CharField(max_length=120, unique=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="subcategories"
    )

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Base(models.Model):
    """A rebel installation that stores and moves supplies (Yavin 4, Hoth, Dantooine, ...)."""

    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=10, unique=True, help_text="Short base code, e.g. YAV-4")
    system = models.CharField(max_length=120, help_text="Star system where the base is located")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Supplier(models.Model):
    """A sympathetic contact, smuggler network or system that sells supplies to the Alliance."""

    name = models.CharField(max_length=150, unique=True)
    home_system = models.CharField(max_length=120, blank=True)
    contact_channel = models.CharField(
        max_length=150, blank=True, help_text="Comm frequency, dead drop, contact name, etc."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Squadron(models.Model):
    """A rebel unit/squadron that supplies get dispatched to."""

    name = models.CharField(max_length=120, unique=True)
    callsign = models.CharField(max_length=30, unique=True)
    commanding_officer = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.callsign})"


class Component(models.Model):
    """A trackable supply item: ship part, weapon, droid unit, medical supply, ration pack, etc."""

    class UnitOfMeasure(models.TextChoices):
        UNIT = "UNIT", "Unit"
        CRATE = "CRATE", "Crate"
        KG = "KG", "Kilogram"
        LITER = "LITER", "Liter"

    sku = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=150)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="components")
    unit_of_measure = models.CharField(
        max_length=10, choices=UnitOfMeasure.choices, default=UnitOfMeasure.UNIT
    )
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    minimum_stock = models.PositiveIntegerField(
        default=0, help_text="Alliance Command is alerted when total stock across bases drops below this."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sku"]
        indexes = [models.Index(fields=["sku"]), models.Index(fields=["name"])]

    def __str__(self) -> str:
        return f"[{self.sku}] {self.name}"


class Stock(models.Model):
    """Current quantity of a Component held at a given Base. Updated only through
    logistics.services (never edited directly) so every change is also recorded
    as a StockMovement."""

    base = models.ForeignKey(Base, on_delete=models.CASCADE, related_name="stock_entries")
    component = models.ForeignKey(Component, on_delete=models.CASCADE, related_name="stock_entries")
    quantity = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["base", "component"], name="unique_stock_per_base_component"),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="stock_quantity_gte_0"),
        ]
        indexes = [models.Index(fields=["base", "component"])]

    def __str__(self) -> str:
        return f"{self.component.sku} @ {self.base.code}: {self.quantity}"


class StockMovement(models.Model):
    """Append-only audit ledger. Every unit that ever enters, leaves, or moves between
    bases is recorded here, in addition to updating the Stock row. Never updated or
    deleted -- this is what makes inventory history reconstructible and auditable."""

    class MovementType(models.TextChoices):
        INBOUND = "INBOUND", "Inbound (received from supplier)"
        OUTBOUND = "OUTBOUND", "Outbound (dispatched to squadron)"
        ADJUSTMENT = "ADJUSTMENT", "Manual adjustment"
        TRANSFER = "TRANSFER", "Transfer between bases"

    base = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="movements")
    component = models.ForeignKey(Component, on_delete=models.PROTECT, related_name="movements")
    movement_type = models.CharField(max_length=12, choices=MovementType.choices)
    quantity = models.IntegerField(help_text="Signed delta applied to Stock.quantity")
    reference = models.CharField(
        max_length=60, blank=True, help_text="Requisition/DeploymentOrder number this movement belongs to"
    )
    reason = models.CharField(max_length=200, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_movements"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["base", "component", "-created_at"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self) -> str:
        return f"{self.movement_type} {self.quantity} x {self.component.sku} @ {self.base.code}"


class Requisition(models.Model):
    """A purchase/supply order placed to a Supplier for delivery to a Base.
    Receiving it (status -> RECEIVED) generates inbound StockMovements."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        RECEIVED = "RECEIVED", "Received"
        CANCELLED = "CANCELLED", "Cancelled"

    number = models.CharField(max_length=20, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="requisitions")
    destination_base = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="requisitions")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requisitions_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.number


class RequisitionLine(models.Model):
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name="lines")
    component = models.ForeignKey(Component, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["requisition", "component"], name="unique_line_per_requisition")
        ]

    def __str__(self) -> str:
        return f"{self.quantity} x {self.component.sku}"


class DeploymentOrder(models.Model):
    """An order dispatching supplies from a Base to a Squadron. Confirming it
    (status -> DISPATCHED) validates available stock and generates outbound
    StockMovements atomically -- see logistics.services.dispatch_order."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DISPATCHED = "DISPATCHED", "Dispatched"
        CANCELLED = "CANCELLED", "Cancelled"

    number = models.CharField(max_length=20, unique=True)
    squadron = models.ForeignKey(Squadron, on_delete=models.PROTECT, related_name="deployment_orders")
    source_base = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="deployment_orders")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="deployment_orders_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.number


class DeploymentOrderLine(models.Model):
    order = models.ForeignKey(DeploymentOrder, on_delete=models.CASCADE, related_name="lines")
    component = models.ForeignKey(Component, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["order", "component"], name="unique_line_per_order")
        ]

    def __str__(self) -> str:
        return f"{self.quantity} x {self.component.sku}"


class Manifest(models.Model):
    """Cargo manifest generated once a DeploymentOrder is dispatched -- the
    Alliance's equivalent of an invoice."""

    order = models.OneToOneField(DeploymentOrder, on_delete=models.PROTECT, related_name="manifest")
    # 30, not 20: the manifest number is derived as f"MAN-{order.number}" and
    # DeploymentOrder.number itself allows up to 20 chars, so a 20-char order
    # number would overflow a 20-char manifest number. Caught by the
    # dispatch-flow E2E test using a realistic (>16 char) generated order
    # number -- the unit tests only ever used short fixture numbers like
    # "DEP-0001", so this never tripped there.
    number = models.CharField(max_length=30, unique=True)
    total_value = models.DecimalField(max_digits=14, decimal_places=2)
    issued_at = models.DateTimeField(auto_now_add=True)
    # Rendered asynchronously by logistics.tasks.generate_manifest_pdf right
    # after dispatch -- empty until the Celery worker picks up the job.
    pdf_file = models.FileField(upload_to="manifests/", null=True, blank=True)

    def __str__(self) -> str:
        return self.number
