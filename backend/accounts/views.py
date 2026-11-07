from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import filters, mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.serializers import AuthTokenSerializer
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .serializers import CurrentUserSerializer, RegisterSerializer, UserSummarySerializer

User = get_user_model()


class AuthViewSet(viewsets.GenericViewSet):
    """Account endpoints: register, login, logout, me."""

    queryset = User.objects.none()
    throttle_scope = "auth"

    def get_permissions(self):
        if self.action in ("register", "login"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.action in ("register", "login") else []

    def get_authenticators(self):
        # A stale token in the Authorization header must not turn login into a 401.
        if self.request.path.rstrip("/").endswith(("/auth/login", "/auth/register")):
            return []
        return super().get_authenticators()

    @action(detail=False, methods=["post"])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
            token = Token.objects.create(user=user)
        return Response(self._session_payload(user, token), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def login(self, request):
        serializer = AuthTokenSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(self._session_payload(user, token))

    @action(detail=False, methods=["post"])
    def logout(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def me(self, request):
        user = User.objects.select_related("profile").get(pk=request.user.pk)
        return Response(CurrentUserSerializer(user).data)

    @staticmethod
    def _session_payload(user, token: Token) -> dict:
        return {"token": token.key, "user": CurrentUserSerializer(user).data}


class UserViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Opponent search: GET /api/users/?search=name."""

    serializer_class = UserSummarySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["username"]

    def get_queryset(self):
        return (
            User.objects.filter(is_active=True)
            .exclude(pk=self.request.user.pk)
            .order_by("username")
        )
