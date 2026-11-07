from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers

from accounts.serializers import UserSummarySerializer

from . import engine
from .models import Game, GamePlayer, Invitation, Move

User = get_user_model()


class SeatSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user_id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = GamePlayer
        fields = ("id", "username", "color")


class MoveSerializer(serializers.ModelSerializer):
    player = serializers.CharField(source="player.username", read_only=True)

    class Meta:
        model = Move
        fields = (
            "number",
            "color",
            "player",
            "notation",
            "captured_count",
            "crowned",
            "created_at",
        )
        read_only_fields = fields


class SubmitMoveSerializer(serializers.Serializer):
    notation = serializers.CharField(max_length=40)

    def validate_notation(self, value: str) -> str:
        try:
            engine.validate_notation(value)
        except engine.NotationError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return value


class GameSummarySerializer(serializers.ModelSerializer):
    players = SeatSerializer(source="game_players", many=True, read_only=True)
    winner = UserSummarySerializer(read_only=True)
    move_count = serializers.IntegerField(read_only=True)
    your_color = serializers.SerializerMethodField()
    is_your_turn = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = (
            "id",
            "status",
            "current_turn",
            "players",
            "winner",
            "end_reason",
            "move_count",
            "your_color",
            "is_your_turn",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def _viewer_id(self) -> int:
        return self.context["request"].user.id

    def get_your_color(self, game: Game) -> str | None:
        viewer_id = self._viewer_id()
        return next(
            (seat.color for seat in game.game_players.all() if seat.user_id == viewer_id), None
        )

    def get_is_your_turn(self, game: Game) -> bool:
        return game.status == Game.Status.ACTIVE and self.get_your_color(game) == game.current_turn


class GameDetailSerializer(GameSummarySerializer):
    board = serializers.SerializerMethodField()
    moves = MoveSerializer(many=True, read_only=True)

    class Meta(GameSummarySerializer.Meta):
        fields = (*GameSummarySerializer.Meta.fields, "board", "moves")
        read_only_fields = fields

    def get_board(self, game: Game) -> engine.Board:
        return game.board_matrix()


class InvitationSerializer(serializers.ModelSerializer):
    inviter = UserSummarySerializer(read_only=True)
    invitee = UserSummarySerializer(read_only=True)
    invitee_username = serializers.CharField(write_only=True, max_length=150)

    class Meta:
        model = Invitation
        fields = (
            "id",
            "inviter",
            "invitee",
            "invitee_username",
            "inviter_color",
            "status",
            "game",
            "created_at",
            "responded_at",
        )
        read_only_fields = ("status", "game", "created_at", "responded_at")

    def validate(self, attrs: dict) -> dict:
        inviter = self.context["request"].user
        username = attrs.pop("invitee_username")
        invitee = User.objects.filter(username__iexact=username, is_active=True).first()
        if invitee is None:
            raise serializers.ValidationError({"invitee_username": "No player has that username."})
        if invitee == inviter:
            raise serializers.ValidationError(
                {"invitee_username": "You can't invite yourself to a game."}
            )
        pending_between_pair = Invitation.objects.filter(
            Q(inviter=inviter, invitee=invitee) | Q(inviter=invitee, invitee=inviter),
            status=Invitation.Status.PENDING,
        )
        if pending_between_pair.exists():
            raise serializers.ValidationError(
                {"invitee_username": f"You already have a pending invitation with {invitee}."}
            )
        attrs["invitee"] = invitee
        return attrs
