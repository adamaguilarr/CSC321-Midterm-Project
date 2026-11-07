from django.conf import settings
from django.core.validators import MaxValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.lookups import Exact

from . import engine


class Color(models.TextChoices):
    RED = engine.RED, "Red"
    WHITE = engine.WHITE, "White"


class Invitation(models.Model):
    """A challenge from one player to another. Accepting it creates the game."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        CANCELLED = "cancelled", "Cancelled"

    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_invitations"
    )
    inviter_color = models.CharField(max_length=5, choices=Color.choices, default=Color.RED)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.PENDING)
    game = models.OneToOneField(
        "Game", on_delete=models.SET_NULL, null=True, blank=True, related_name="invitation"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    # "lowId:highId" while pending, NULL once closed. UNIQUE ignores NULLs, so this allows
    # one open invitation per pair in either direction. A partial unique index would be
    # the obvious alternative, but it crashes SQLite 3.52's query planner on OR filters
    # with bound parameters ("internal query planner error").
    pending_pair = models.CharField(
        max_length=41, null=True, blank=True, unique=True, editable=False
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=~Q(inviter=F("invitee")), name="invitation_not_self"),
        ]

    def __str__(self) -> str:
        return f"{self.inviter} -> {self.invitee} ({self.status})"

    def save(self, *args, **kwargs) -> None:
        low, high = sorted((self.inviter_id, self.invitee_id))
        self.pending_pair = f"{low}:{high}" if self.status == self.Status.PENDING else None
        super().save(*args, **kwargs)


class Game(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    class EndReason(models.TextChoices):
        NO_MOVES = "no_moves", "Opponent has no legal moves"
        RESIGNATION = "resignation", "Resignation"
        DRAW_RULE = "draw_rule", "40 moves without a capture or a man moving"

    players = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="GamePlayer", related_name="games"
    )
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.ACTIVE)
    current_turn = models.CharField(max_length=5, choices=Color.choices, default=Color.RED)
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="games_won",
    )
    end_reason = models.CharField(max_length=11, choices=EndReason.choices, blank=True)
    # Half-moves since the last capture or man move. 80 of them is a draw.
    quiet_plies = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["status", "-updated_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(winner__isnull=True) | Q(status="completed"),
                name="game_winner_only_when_completed",
            ),
        ]

    def __str__(self) -> str:
        return f"Game {self.pk} ({self.status})"

    def board_matrix(self) -> engine.Board:
        """Rebuild the 8x8 matrix from Piece rows. Uses the prefetch cache when present."""
        board = [[engine.EMPTY] * engine.BOARD_SIZE for _ in range(engine.BOARD_SIZE)]
        for piece in self.pieces.all():
            board[piece.row][piece.column] = piece.code
        return board


class GamePlayer(models.Model):
    """Through table for Game.players: who is sitting at which colour."""

    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="game_players")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_seats"
    )
    color = models.CharField(max_length=5, choices=Color.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["game", "user"], name="seat_one_per_player"),
            models.UniqueConstraint(fields=["game", "color"], name="seat_one_per_color"),
        ]

    def __str__(self) -> str:
        return f"{self.user} as {self.color} in game {self.game_id}"


class Piece(models.Model):
    """One occupied square. An empty square is simply the absence of a row, and a
    captured piece is deleted, so the database can't hold two pieces on one square
    or a piece on a light square.
    """

    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="pieces")
    row = models.PositiveSmallIntegerField(validators=[MaxValueValidator(engine.BOARD_SIZE - 1)])
    column = models.PositiveSmallIntegerField(validators=[MaxValueValidator(engine.BOARD_SIZE - 1)])
    color = models.CharField(max_length=5, choices=Color.choices)
    is_king = models.BooleanField(default=False)

    class Meta:
        ordering = ["row", "column"]
        constraints = [
            models.UniqueConstraint(fields=["game", "row", "column"], name="piece_one_per_square"),
            models.CheckConstraint(
                condition=Q(row__lte=engine.BOARD_SIZE - 1, column__lte=engine.BOARD_SIZE - 1),
                name="piece_on_board",
            ),
            models.CheckConstraint(
                condition=Exact((F("row") + F("column")) % 2, 1),
                name="piece_on_dark_square",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.color} {'king' if self.is_king else 'man'} at {self.square.name}"

    @property
    def square(self) -> engine.Square:
        return engine.Square(self.row, self.column)

    @property
    def code(self) -> int:
        rank = engine.RED_KING if self.is_king else engine.RED_MAN
        return rank * engine.SIGN[self.color]


notation_validator = RegexValidator(
    regex=r"^[a-h][1-8](?:-[a-h][1-8]|(?:x[a-h][1-8])+)$",
    message="Use algebraic notation such as c3-d4 or c3xe5xg7.",
)


class Move(models.Model):
    """Permanent record of one turn, in algebraic notation."""

    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="moves")
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="moves"
    )
    number = models.PositiveIntegerField()
    color = models.CharField(max_length=5, choices=Color.choices)
    # A chain crosses at most 12 enemy pieces: 13 squares and 12 separators, 38 characters.
    notation = models.CharField(max_length=40, validators=[notation_validator])
    captured_count = models.PositiveSmallIntegerField(default=0)
    crowned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["number"]
        constraints = [
            # The backstop against a double-submitted turn: two moves can't share a slot.
            models.UniqueConstraint(fields=["game", "number"], name="move_unique_number"),
        ]

    def __str__(self) -> str:
        return f"{self.number}. {self.notation}"
