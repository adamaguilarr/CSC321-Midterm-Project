from django.contrib import admin
from django.urls import include, path

from accounts.views import AuthViewSet, UserViewSet
from config.routers import ApiRouter

router = ApiRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]
