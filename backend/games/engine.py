"""Rules of English draughts (American checkers), independent of Django.

The board is a list of 8 rows, where ``board[row][col]`` holds a piece code. Row 0
is rank 8 (the top of the board from Red's seat) and column 0 is file a, so a1 is
``board[7][0]``. Pieces only ever stand on dark squares, where ``row + col`` is odd.

Piece codes carry their meaning arithmetically: the sign is the colour and the
magnitude is the rank (1 = man, 2 = king).

Rules enforced: men move and capture forward, kings in all four directions;
capturing is mandatory; a multi-jump must be finished; a man reaching the far rank
is crowned and its turn ends; a player with no legal move loses.
"""

import re
from dataclasses import dataclass
from typing import NamedTuple

BOARD_SIZE = 8
EMPTY = 0
RED_MAN, RED_KING = 1, 2
WHITE_MAN, WHITE_KING = -1, -2

RED = "red"
WHITE = "white"

# Red sits on ranks 1-3 and advances toward rank 8, which is row 0.
FORWARD = {RED: -1, WHITE: 1}
KING_ROW = {RED: 0, WHITE: BOARD_SIZE - 1}
SIGN = {RED: 1, WHITE: -1}

_NOTATION = re.compile(r"^[a-h][1-8](?:-[a-h][1-8]|(?:x[a-h][1-8])+)$")

Board = list[list[int]]


class Square(NamedTuple):
    row: int
    col: int

    @property
    def name(self) -> str:
        return f"{chr(ord('a') + self.col)}{BOARD_SIZE - self.row}"

    @classmethod
    def from_name(cls, name: str) -> "Square":
        return cls(BOARD_SIZE - int(name[1]), ord(name[0]) - ord("a"))


@dataclass(frozen=True)
class Move:
    path: tuple[Square, ...]
    captures: tuple[Square, ...] = ()

    @property
    def is_capture(self) -> bool:
        return bool(self.captures)

    @property
    def notation(self) -> str:
        separator = "x" if self.is_capture else "-"
        return separator.join(square.name for square in self.path)


class NotationError(ValueError):
    """The text isn't well-formed algebraic notation."""


class IllegalMoveError(ValueError):
    """The notation is well-formed, but the rules don't allow the move."""


def opponent(color: str) -> str:
    return WHITE if color == RED else RED


def color_of(piece: int) -> str | None:
    if piece == EMPTY:
        return None
    return RED if piece > 0 else WHITE


def is_king(piece: int) -> bool:
    return abs(piece) == RED_KING


def is_dark(square: Square) -> bool:
    return (square.row + square.col) % 2 == 1


def initial_board() -> Board:
    board = [[EMPTY] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            if not is_dark(Square(row, col)):
                continue
            if row < 3:
                board[row][col] = WHITE_MAN
            elif row > 4:
                board[row][col] = RED_MAN
    return board


def validate_notation(text: str) -> None:
    """Check syntax and geometry only: dark squares, and steps of the right length."""
    if not _NOTATION.match(text):
        raise NotationError(
            f'"{text}" is not valid notation. Use "c3-d4" for a step or "c3xe5xg7" for jumps.'
        )
    is_capture = "x" in text
    path = [Square.from_name(name) for name in re.split(r"[-x]", text)]
    if not all(is_dark(square) for square in path):
        raise NotationError(f'"{text}" uses a light square; pieces only stand on dark squares.')
    expected = 2 if is_capture else 1
    for start, end in zip(path, path[1:], strict=False):
        if abs(start.row - end.row) != expected or abs(start.col - end.col) != expected:
            kind = "a jump" if is_capture else "a step"
            raise NotationError(f'"{text}" contains {start.name} to {end.name}, not {kind}.')


def _in_bounds(row: int, col: int) -> bool:
    return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE


def _directions(piece: int) -> list[tuple[int, int]]:
    if is_king(piece):
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    forward = FORWARD[color_of(piece)]
    return [(forward, -1), (forward, 1)]


def _jump_sequences(
    board: Board,
    piece: int,
    current: Square,
    path: tuple[Square, ...],
    captured: tuple[Square, ...],
) -> list[Move]:
    """Depth-first search of every maximal jump chain from ``current``.

    ``board`` has the moving piece lifted off its origin, so a king may loop back
    through it. Jumped pieces stay on the board until the turn ends and can't be
    jumped a second time.
    """
    moves: list[Move] = []
    enemy = opponent(color_of(piece))
    for d_row, d_col in _directions(piece):
        over = Square(current.row + d_row, current.col + d_col)
        land = Square(current.row + 2 * d_row, current.col + 2 * d_col)
        if not _in_bounds(*land):
            continue
        if color_of(board[over.row][over.col]) != enemy or over in captured:
            continue
        if board[land.row][land.col] != EMPTY:
            continue
        moves.extend(_jump_sequences(board, piece, land, (*path, land), (*captured, over)))
    if not moves and captured:
        return [Move(path, captured)]
    return moves


def legal_moves(board: Board, color: str) -> list[Move]:
    """All complete legal moves for ``color``. If any capture exists, only captures."""
    jumps: list[Move] = []
    steps: list[Move] = []
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            piece = board[row][col]
            if color_of(piece) != color:
                continue
            origin = Square(row, col)
            board[row][col] = EMPTY
            jumps.extend(_jump_sequences(board, piece, origin, (origin,), ()))
            board[row][col] = piece
            for d_row, d_col in _directions(piece):
                target = Square(row + d_row, col + d_col)
                if _in_bounds(*target) and board[target.row][target.col] == EMPTY:
                    steps.append(Move((origin, target)))
    return jumps or steps


def resolve_move(board: Board, color: str, notation: str) -> Move:
    """Match notation to a legal move, explaining why when there isn't one."""
    validate_notation(notation)
    origin = Square.from_name(notation[:2])
    piece = board[origin.row][origin.col]
    if piece == EMPTY:
        raise IllegalMoveError(f"There is no piece on {origin.name}.")
    if color_of(piece) != color:
        raise IllegalMoveError(f"The piece on {origin.name} isn't yours.")

    moves = legal_moves(board, color)
    for move in moves:
        if move.notation == notation:
            return move

    if moves and moves[0].is_capture:
        if "-" in notation:
            raise IllegalMoveError("A capture is available, so you must jump.")
        for move in moves:
            if move.notation.startswith(f"{notation}x"):
                raise IllegalMoveError(
                    f"{notation} stops too early: the jump must continue ({move.notation})."
                )
    raise IllegalMoveError(f"{notation} is not a legal move.")


def crowns(piece: int, destination: Square) -> bool:
    return not is_king(piece) and destination.row == KING_ROW[color_of(piece)]


def apply_move(board: Board, move: Move) -> Board:
    """Return a new board with ``move`` played. The input board is not modified."""
    result = [row[:] for row in board]
    start, end = move.path[0], move.path[-1]
    piece = result[start.row][start.col]
    result[start.row][start.col] = EMPTY
    for square in move.captures:
        result[square.row][square.col] = EMPTY
    if crowns(piece, end):
        piece = piece * RED_KING
    result[end.row][end.col] = piece
    return result
