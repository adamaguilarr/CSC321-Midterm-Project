from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied


class NotYourTurn(PermissionDenied):
    default_detail = "It's not your turn."
    default_code = "not_your_turn"


class IllegalMove(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "That move isn't legal."
    default_code = "illegal_move"


class GameFinished(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This game has already finished."
    default_code = "game_finished"


class MoveConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The board changed while that move was being saved. Refresh and try again."
    default_code = "move_conflict"


class InvitationNotPending(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This invitation has already been answered."
    default_code = "invitation_not_pending"
