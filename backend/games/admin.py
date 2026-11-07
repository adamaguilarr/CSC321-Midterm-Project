from django.contrib import admin

from .models import Game, GamePlayer, Invitation, Move, Piece


class GamePlayerInline(admin.TabularInline):
    model = GamePlayer
    extra = 0


class PieceInline(admin.TabularInline):
    model = Piece
    extra = 0


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "current_turn", "winner", "updated_at")
    list_filter = ("status",)
    list_select_related = ("winner",)
    inlines = [GamePlayerInline, PieceInline]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("id", "inviter", "invitee", "status", "created_at")
    list_filter = ("status",)
    list_select_related = ("inviter", "invitee")


@admin.register(Move)
class MoveAdmin(admin.ModelAdmin):
    list_display = ("game", "number", "player", "notation")
    list_select_related = ("game", "player")
