from django.contrib import admin

from .models import PlayerProfile


@admin.register(PlayerProfile)
class PlayerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "wins", "losses", "draws")
    list_select_related = ("user",)
    search_fields = ("user__username",)
