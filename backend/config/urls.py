from django.contrib import admin
from django.urls import include, path

from accounts.views import AuthViewSet, UserViewSet
from config.routers import ApiRouter
from games.views import GameViewSet, InvitationViewSet

router = ApiRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("users", UserViewSet, basename="user")
router.register("games", GameViewSet, basename="game")
router.register("invitations", InvitationViewSet, basename="invitation")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]
