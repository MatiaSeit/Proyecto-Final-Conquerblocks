from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from logistics import services
from logistics.models import (
    Base,
    Category,
    Component,
    DeploymentOrder,
    Requisition,
    Squadron,
    Supplier,
)


class Command(BaseCommand):
    help = "Seed the database with a demo Rebel Alliance logistics dataset."

    @transaction.atomic
    def handle(self, *args, **options):
        command_user, _ = User.objects.get_or_create(
            username="command",
            defaults={"role": User.Role.COMMAND, "is_staff": True, "is_superuser": True},
        )
        command_user.set_password("RebelYell123!")
        command_user.save()

        User.objects.get_or_create(
            username="quartermaster", defaults={"role": User.Role.QUARTERMASTER}
        )[0].set_password("RebelYell123!")
        User.objects.get_or_create(
            username="dispatcher", defaults={"role": User.Role.DISPATCHER}
        )[0].set_password("RebelYell123!")
        for u in User.objects.filter(username__in=["quartermaster", "dispatcher"]):
            u.set_password("RebelYell123!")
            u.save()

        yavin, _ = Base.objects.get_or_create(name="Great Temple", code="YAV-4", system="Yavin")
        hoth, _ = Base.objects.get_or_create(name="Echo Base", code="HTH-1", system="Hoth")

        starfighter_parts, _ = Category.objects.get_or_create(name="Starfighter Parts")
        weapons, _ = Category.objects.get_or_create(name="Weapons")
        medical, _ = Category.objects.get_or_create(name="Medical Supplies")

        components = {
            "XW-ASTRO-01": Component.objects.get_or_create(
                sku="XW-ASTRO-01", defaults=dict(
                    name="R2 Astromech Socket", category=starfighter_parts,
                    unit_cost="120.00", unit_price="180.00", minimum_stock=5,
                )
            )[0],
            "XW-SHIELD-GEN": Component.objects.get_or_create(
                sku="XW-SHIELD-GEN", defaults=dict(
                    name="X-wing Shield Generator", category=starfighter_parts,
                    unit_cost="900.00", unit_price="1350.00", minimum_stock=2,
                )
            )[0],
            "BLASTER-A280": Component.objects.get_or_create(
                sku="BLASTER-A280", defaults=dict(
                    name="A280 Blaster Rifle", category=weapons,
                    unit_cost="250.00", unit_price="400.00", minimum_stock=10,
                )
            )[0],
            "BACTA-VIAL": Component.objects.get_or_create(
                sku="BACTA-VIAL", defaults=dict(
                    name="Bacta Vial", category=medical,
                    unit_cost="15.00", unit_price="25.00", minimum_stock=50,
                )
            )[0],
        }

        supplier, _ = Supplier.objects.get_or_create(
            name="Chiew's Freight Network", defaults=dict(home_system="Corellia")
        )
        Squadron.objects.get_or_create(
            name="Red Squadron", callsign="RED", defaults=dict(commanding_officer="Garven Dreis")
        )
        Squadron.objects.get_or_create(
            name="Rogue Squadron", callsign="ROGUE", defaults=dict(commanding_officer="Wedge Antilles")
        )

        requisition, created = Requisition.objects.get_or_create(
            number="REQ-DEMO-001",
            defaults=dict(
                supplier=supplier, destination_base=yavin,
                status=Requisition.Status.SUBMITTED, created_by=command_user,
            ),
        )
        if created:
            requisition.lines.create(component=components["XW-ASTRO-01"], quantity=20, unit_cost=120)
            requisition.lines.create(component=components["BLASTER-A280"], quantity=40, unit_cost=250)
            requisition.lines.create(component=components["BACTA-VIAL"], quantity=100, unit_cost=15)
            services.receive_requisition(requisition, performed_by=command_user)
            self.stdout.write(self.style.SUCCESS(f"Received {requisition.number} into {yavin.code}"))

        order, created = DeploymentOrder.objects.get_or_create(
            number="DEP-DEMO-001",
            defaults=dict(
                squadron=Squadron.objects.get(callsign="RED"), source_base=yavin,
                status=DeploymentOrder.Status.CONFIRMED, created_by=command_user,
            ),
        )
        if created:
            order.lines.create(component=components["XW-ASTRO-01"], quantity=5, unit_price=180)
            order.lines.create(component=components["BLASTER-A280"], quantity=12, unit_price=400)
            services.dispatch_order(order, performed_by=command_user)
            self.stdout.write(self.style.SUCCESS(f"Dispatched {order.number} to Red Squadron"))

        self.stdout.write(self.style.SUCCESS(
            "\nDemo data ready. Login with: command / quartermaster / dispatcher, password RebelYell123!"
        ))
