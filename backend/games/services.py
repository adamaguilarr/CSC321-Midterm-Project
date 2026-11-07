"""State changes for games and invitations.

Each function is one database transaction: a move either lands completely (pieces,
turn, history, result) or not at all.
"""

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from accounts.models import PlayerProfile

from . import engine
from .exceptions import GameFinished, IllegalMove, InvitationNotPending, MoveConflict, NotYourTurn
from .models import Game, GamePlayer, Invitation, Move, Piece

DRAW_AFTER_QUIET_PLIES = 80


def accept_invitation(invitation_id: int) -> Invitation:
    with transaction.atomic():
        invitation = _lock_pending_invitation(invitation_id)
        game = Game.objects.create()
        inviter_color = invitation.inviter_color
        GamePlayer.objects.bulk_create(
            [
                GamePlayer(game=game, user_id=invitation.inviter_id, color=inviter_color),
                GamePlayer(
                    game=game, user_id=invitation.invitee_id, color=engine.opponent(inviter_color)
                ),
            ]
        )
        Piece.objects.bulk_create(_starting_pieces(game))
        invitation.game = game
        _close_invitation(invitation, Invitation.Status.ACCEPTED, extra_fields=["game"])
    return invitation


def close_invitation(invitation_id: int, status: str) -> Invitation:
    """Decline or cancel a pending invitation."""
    with transaction.atomic():
        invitation = _lock_pending_invitation(invitation_id)
        _close_invitation(invitation, status)
    return invitation


def play_move(game_id: int, user, notation: str) -> None:
    """Validate and apply one turn. All checks run against the locked row."""
    try:
        with transaction.atomic():
            game = Game.objects.select_for_update().get(pk=game_id)
            color = _active_seat(game, user).color
            if color != game.current_turn:
                raise NotYourTurn()

            board = game.board_matrix()
            try:
                move = engine.resolve_move(board, color, notation)
            except (engine.NotationError, engine.IllegalMoveError) as exc:
                raise IllegalMove(str(exc)) from exc

            origin = move.path[0]
            was_king = engine.is_king(board[origin.row][origin.col])
            crowned = _write_pieces(game, move)
            Move.objects.create(
                game=game,
                player=user,
                number=game.moves.count() + 1,
                color=color,
                notation=move.notation,
                captured_count=len(move.captures),
                crowned=crowned,
            )
            _advance_game(game, engine.apply_move(board, move), color, user, move, was_king)
    except IntegrityError as exc:
        # The unique constraints caught a concurrent write the lock didn't prevent.
        raise MoveConflict() from exc


def resign(game_id: int, user) -> None:
    """A player may resign at any time, on either player's turn."""
    with transaction.atomic():
        game = Game.objects.select_for_update().get(pk=game_id)
        seat = _active_seat(game, user)
        winner_id = game.game_players.exclude(pk=seat.pk).values_list("user_id", flat=True).get()
        _finish_game(game, winner_id, Game.EndReason.RESIGNATION)


def _lock_pending_invitation(invitation_id: int) -> Invitation:
    invitation = Invitation.objects.select_for_update().get(pk=invitation_id)
    if invitation.status != Invitation.Status.PENDING:
        raise InvitationNotPending()
    return invitation


def _close_invitation(invitation: Invitation, status: str, extra_fields: list[str] | None = None):
    invitation.status = status
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=["status", "responded_at", "pending_pair", *(extra_fields or [])])


def _starting_pieces(game: Game) -> list[Piece]:
    return [
        Piece(
            game=game,
            row=row,
            column=col,
            color=engine.color_of(code),
            is_king=engine.is_king(code),
        )
        for row, cells in enumerate(engine.initial_board())
        for col, code in enumerate(cells)
        if code != engine.EMPTY
    ]


def _active_seat(game: Game, user) -> GamePlayer:
    if game.status != Game.Status.ACTIVE:
        raise GameFinished()
    return GamePlayer.objects.get(game=game, user=user)


def _write_pieces(game: Game, move: engine.Move) -> bool:
    """Mirror a move onto Piece rows. Returns whether the moving piece was crowned."""
    pieces = {piece.square: piece for piece in game.pieces.all()}
    start, end = move.path[0], move.path[-1]

    captured_ids = [pieces[square].pk for square in move.captures]
    if captured_ids:
        Piece.objects.filter(pk__in=captured_ids).delete()

    moving = pieces[start]
    crowned = engine.crowns(moving.code, end)
    moving.row, moving.column = end.row, end.col
    moving.is_king = moving.is_king or crowned
    moving.save(update_fields=["row", "column", "is_king"])
    return crowned


def _advance_game(
    game: Game, board: engine.Board, color: str, user, move: engine.Move, was_king: bool
) -> None:
    next_color = engine.opponent(color)
    resets_draw_clock = move.is_capture or not was_king
    game.quiet_plies = 0 if resets_draw_clock else game.quiet_plies + 1
    game.current_turn = next_color

    if not engine.legal_moves(board, next_color):
        _finish_game(game, user.pk, Game.EndReason.NO_MOVES)
    elif game.quiet_plies >= DRAW_AFTER_QUIET_PLIES:
        _finish_game(game, None, Game.EndReason.DRAW_RULE)
    else:
        game.save(update_fields=["current_turn", "quiet_plies", "updated_at"])


def _finish_game(game: Game, winner_id: int | None, reason: str) -> None:
    game.status = Game.Status.COMPLETED
    game.winner_id = winner_id
    game.end_reason = reason
    game.save(
        update_fields=[
            "status",
            "winner",
            "end_reason",
            "current_turn",
            "quiet_plies",
            "updated_at",
        ]
    )
    player_ids = list(game.game_players.values_list("user_id", flat=True))
    profiles = PlayerProfile.objects.filter(user_id__in=player_ids)
    if winner_id is None:
        profiles.update(draws=F("draws") + 1)
    else:
        profiles.filter(user_id=winner_id).update(wins=F("wins") + 1)
        profiles.exclude(user_id=winner_id).update(losses=F("losses") + 1)
