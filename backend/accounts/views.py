from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import MeSerializer


class MeView(APIView):
    """Returns the authenticated user's profile, including their role --
    the frontend uses this once after login to decide what to show in the nav."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class LoginRateThrottle(AnonRateThrottle):
    """Scoped to the login endpoint only (see ThrottledTokenObtainPairView)
    -- a brute-force guard, not a blanket API rate limit. The rate itself
    lives in REST_FRAMEWORK.DEFAULT_THROTTLE_RATES["login"]."""

    scope = "login"


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Identical to simplejwt's TokenObtainPairView, just rate-limited per
    IP so repeated wrong-password guesses get slowed down (429) instead of
    retried instantly forever."""

    throttle_classes = [LoginRateThrottle]
