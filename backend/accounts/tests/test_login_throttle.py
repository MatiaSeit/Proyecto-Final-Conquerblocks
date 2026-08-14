from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User


class LoginThrottleTests(TestCase):
    """Login is rate-limited per IP (accounts.views.LoginRateThrottle) so
    repeated bad-password guesses get slowed down instead of retried
    instantly forever. DEFAULT_THROTTLE_RATES["login"] = "5/min"."""

    def setUp(self):
        # Throttle counters live in Django's cache, which persists across
        # tests in the same process -- start each test with a clean slate.
        cache.clear()
        User.objects.create_user(
            username="quartermaster", password="RebelYell123!", role=User.Role.QUARTERMASTER
        )

    def test_allows_requests_up_to_the_limit(self):
        client = APIClient()
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/token/", {"username": "quartermaster", "password": "wrong"}, format="json"
            )
            # Wrong password, but not throttled yet.
            assert response.status_code == 401

    def test_blocks_once_the_limit_is_exceeded(self):
        client = APIClient()
        for _ in range(5):
            client.post("/api/v1/auth/token/", {"username": "quartermaster", "password": "wrong"}, format="json")

        response = client.post(
            "/api/v1/auth/token/", {"username": "quartermaster", "password": "wrong"}, format="json"
        )
        assert response.status_code == 429

    def test_correct_credentials_still_work_under_the_limit(self):
        client = APIClient()
        response = client.post(
            "/api/v1/auth/token/", {"username": "quartermaster", "password": "RebelYell123!"}, format="json"
        )
        assert response.status_code == 200
        assert "access" in response.data
