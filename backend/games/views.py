from django.db.models import Count, Prefetch, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Game, GamePlayer, Invitation, Move
from .permissions import IsGameParticipant, IsInvitee, IsInviter, IsPlayersTurn
from .serializers import (
    GameDetailSerializer,
    GameSummarySerializer,
    InvitationSerializer,
    MoveSerializer,
    SubmitMoveSerializer,
)


def _game_queryset():
    """Everything a game card needs, in a fixed number of queries."""
    return (
        Game.objects.select_related("winner")
        .prefetch_related(
            Prefetch("game_players", queryset=GamePlayer.objects.select_related("user"))
        )
        .annotate(move_count=Count("moves", distinct=True))
    )


def _game_detail_queryset():
    return _game_queryset().prefetch_related(
        "pieces", Prefetch("moves", queryset=Move.objects.select_related("player"))
    )


class GameViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/games/?status=active|completed  the caller's games
    GET  /api/games/{id}/                     board, seats and history
    GET  /api/games/{id}/moves/               move history
    POST /api/games/{id}/moves/               play {"notation": "c3-d4"}
    POST /api/games/{id}/resign/              concede
    """

    def get_queryset(self):
        if self.action == "list":
            return self._filter_list(_game_queryset().filter(players=self.request.user))
        if self.action == "retrieve":
            return _game_detail_queryset()
        return _game_queryset()

    def _filter_list(self, queryset):
        wanted = self.request.query_params.get("status")
        if wanted is None:
            return queryset
        if wanted not in Game.Status.values:
            raise ValidationError({"status": f"Must be one of: {', '.join(Game.Status.values)}."})
        return queryset.filter(status=wanted)

    def get_serializer_class(self):
        return GameSummarySerializer if self.action == "list" else GameDetailSerializer

    def get_permissions(self):
        permissions = [IsAuthenticated]
        if self.action != "list":
            permissions.append(IsGameParticipant)
        if self.action == "moves" and self.request.method == "POST":
            permissions.append(IsPlayersTurn)
        return [permission() for permission in permissions]

    @action(detail=True, methods=["get", "post"])
    def moves(self, request, pk=None):
        game = self.get_object()
        if request.method == "GET":
            queryset = game.moves.select_related("player")
            page = self.paginate_queryset(queryset)
            return self.get_paginated_response(MoveSerializer(page, many=True).data)

        serializer = SubmitMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.play_move(game.pk, request.user, serializer.validated_data["notation"])
        return self._fresh_game_response(game.pk, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def resign(self, request, pk=None):
        game = self.get_object()
        services.resign(game.pk, request.user)
        return self._fresh_game_response(game.pk, status.HTTP_200_OK)

    def _fresh_game_response(self, game_id: int, status_code: int) -> Response:
        game = _game_detail_queryset().get(pk=game_id)
        return Response(self.get_serializer(game).data, status=status_code)


class InvitationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET  /api/invitations/?status=pending  invitations sent or received by the caller
    POST /api/invitations/                 {"invitee_username": "...", "inviter_color": "red"}
    POST /api/invitations/{id}/accept/     invitee only; creates the game
    POST /api/invitations/{id}/decline/    invitee only
    POST /api/invitations/{id}/cancel/     inviter only
    """

    serializer_class = InvitationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Invitation.objects.select_related("inviter", "invitee").filter(
            Q(inviter=user) | Q(invitee=user)
        )
        wanted = self.request.query_params.get("status")
        if self.action == "list" and wanted is not None:
            if wanted not in Invitation.Status.values:
                raise ValidationError(
                    {"status": f"Must be one of: {', '.join(Invitation.Status.values)}."}
                )
            queryset = queryset.filter(status=wanted)
        return queryset

    def get_permissions(self):
        extra = {"accept": IsInvitee, "decline": IsInvitee, "cancel": IsInviter}.get(self.action)
        return [IsAuthenticated(), *([extra()] if extra else [])]

    def perform_create(self, serializer):
        serializer.save(inviter=self.request.user)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = self.get_object()
        return Response(self.get_serializer(services.accept_invitation(invitation.pk)).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        return self._close(Invitation.Status.DECLINED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._close(Invitation.Status.CANCELLED)

    def _close(self, new_status: str) -> Response:
        invitation = self.get_object()
        return Response(
            self.get_serializer(services.close_invitation(invitation.pk, new_status)).data
        )
