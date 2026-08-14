import pytest

from accounts.models import User
from logistics.models import Base, Category, Component, Squadron, Supplier


@pytest.fixture
def command_user(db):
    return User.objects.create_user(username="command", password="x", role=User.Role.COMMAND)


@pytest.fixture
def hoth_base(db):
    return Base.objects.create(name="Echo Base", code="HTH-1", system="Hoth")


@pytest.fixture
def yavin_base(db):
    return Base.objects.create(name="Great Temple", code="YAV-4", system="Yavin")


@pytest.fixture
def category(db):
    return Category.objects.create(name="Starfighter Parts")


@pytest.fixture
def component(db, category):
    return Component.objects.create(
        sku="XW-ASTRO-01",
        name="R2 Astromech Socket",
        category=category,
        unit_cost="120.00",
        unit_price="180.00",
        minimum_stock=5,
    )


@pytest.fixture
def supplier(db):
    return Supplier.objects.create(name="Chiew's Freight Network", home_system="Corellia")


@pytest.fixture
def squadron(db):
    return Squadron.objects.create(name="Red Squadron", callsign="RED", commanding_officer="Garven Dreis")
