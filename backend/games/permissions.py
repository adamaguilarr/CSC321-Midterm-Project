from rest_framework.permissions import BasePermission


def _seat_for(game, user):
    return next((seat for seat in game.game_players.all() if seat.user_id == user.id), None)


class IsGameParticipant(BasePermission):
    message = "You aren't a player in this game."

    def has_object_permission(self, request, view, obj) -> bool:
        return _seat_for(obj, request.user) is not None


class IsPlayersTurn(BasePermission):
    """Fast rejection before the payload is parsed.

    services.play_move repeats this check under the row lock, which is the check
    that actually guards against races. A finished game passes here so that it
    gets the more accurate 409 from the service.
    """

    message = "It's not your turn."
    code = "not_your_turn"

    def has_object_permission(self, request, view, obj) -> bool:
        if obj.status != obj.Status.ACTIVE:
            return True
        seat = _seat_for(obj, request.user)
        return seat is not None and seat.color == obj.current_turn


class IsInvitee(BasePermission):
    message = "Only the invited player can answer this invitation."

    def has_object_permission(self, request, view, obj) -> bool:
        return obj.invitee_id == request.user.id


class IsInviter(BasePermission):
    message = "Only the player who sent this invitation can cancel it."

    def has_object_permission(self, request, view, obj) -> bool:
        return obj.inviter_id == request.user.id
