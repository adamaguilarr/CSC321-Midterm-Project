from django.conf import settings
from django.db import models


class PlayerProfile(models.Model):
    """Lifetime record for a player, one-to-one with the auth user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    draws = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.user}: {self.wins}-{self.losses}-{self.draws}"
