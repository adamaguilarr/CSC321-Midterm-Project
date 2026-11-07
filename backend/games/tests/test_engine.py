from django.test import SimpleTestCase

from games import engine
from games.engine import (
    RED,
    RED_KING,
    RED_MAN,
    WHITE,
    WHITE_KING,
    WHITE_MAN,
    IllegalMoveError,
    NotationError,
    Square,
)


def board_with(**pieces: int) -> engine.Board:
    """board_with(c3=RED_MAN, d4=WHITE_MAN)"""
    board = [[engine.EMPTY] * 8 for _ in range(8)]
    for name, piece in pieces.items():
        square = Square.from_name(name)
        board[square.row][square.col] = piece
    return board


def notations(board: engine.Board, color: str) -> set[str]:
    return {move.notation for move in engine.legal_moves(board, color)}


class CoordinateTests(SimpleTestCase):
    def test_a1_is_bottom_left_and_dark(self):
        self.assertEqual(Square.from_name("a1"), Square(7, 0))
        self.assertEqual(Square(7, 0).name, "a1")
        self.assertTrue(engine.is_dark(Square(7, 0)))

    def test_h8_is_top_right(self):
        self.assertEqual(Square.from_name("h8"), Square(0, 7))


class InitialPositionTests(SimpleTestCase):
    def test_twelve_men_each_on_dark_squares(self):
        board = engine.initial_board()
        flat = [piece for row in board for piece in row]
        self.assertEqual(flat.count(RED_MAN), 12)
        self.assertEqual(flat.count(WHITE_MAN), 12)
        for row in range(8):
            for col in range(8):
                if board[row][col]:
                    self.assertTrue(engine.is_dark(Square(row, col)))

    def test_red_has_seven_opening_moves(self):
        self.assertEqual(
            notations(engine.initial_board(), RED),
            {"a3-b4", "c3-b4", "c3-d4", "e3-d4", "e3-f4", "g3-f4", "g3-h4"},
        )


class NotationTests(SimpleTestCase):
    def test_accepts_steps_and_multi_jumps(self):
        for text in ("c3-d4", "c3xe5", "c3xe5xg7"):
            engine.validate_notation(text)

    def test_rejects_malformed_text(self):
        bad = ["", "c3", "c3d4", "C3-D4", "i3-d4", "c9-d4", "c3-d4-e5", "c3-d4xf6", " c3-d4", "c3x"]
        for text in bad:
            with self.subTest(text=text), self.assertRaises(NotationError):
                engine.validate_notation(text)

    def test_rejects_light_squares(self):
        with self.assertRaises(NotationError):
            engine.validate_notation("a2-b3")

    def test_rejects_wrong_distances(self):
        for text in ("c3-e5", "c3xd4", "c3-c5", "c3xe5xf6"):
            with self.subTest(text=text), self.assertRaises(NotationError):
                engine.validate_notation(text)


class MovementTests(SimpleTestCase):
    def test_men_only_step_forward(self):
        self.assertEqual(notations(board_with(d4=RED_MAN), RED), {"d4-c5", "d4-e5"})
        self.assertEqual(notations(board_with(d4=WHITE_MAN), WHITE), {"d4-c3", "d4-e3"})

    def test_kings_step_in_all_directions(self):
        self.assertEqual(
            notations(board_with(d4=RED_KING), RED), {"d4-c5", "d4-e5", "d4-c3", "d4-e3"}
        )

    def test_blocked_piece_has_no_move(self):
        board = board_with(a1=RED_MAN, b2=RED_MAN, a3=RED_MAN, c3=RED_MAN)
        self.assertNotIn("a1-b2", notations(board, RED))


class CaptureTests(SimpleTestCase):
    def test_capture_is_mandatory(self):
        board = board_with(c3=RED_MAN, d4=WHITE_MAN, g3=RED_MAN)
        self.assertEqual(notations(board, RED), {"c3xe5"})

    def test_men_cannot_capture_backward(self):
        board = board_with(d4=RED_MAN, c3=WHITE_MAN)
        self.assertNotIn("d4xb2", notations(board, RED))

    def test_kings_can_capture_backward(self):
        board = board_with(d4=RED_KING, c3=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"d4xb2"})

    def test_multi_jump_must_complete(self):
        board = board_with(a1=RED_MAN, b2=WHITE_MAN, d4=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"a1xc3xe5"})

    def test_branching_jumps_are_all_offered(self):
        board = board_with(c1=RED_MAN, d2=WHITE_MAN, d4=WHITE_MAN, f4=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"c1xe3xc5", "c1xe3xg5"})

    def test_shorter_capture_may_be_chosen_over_a_longer_one(self):
        board = board_with(a1=RED_MAN, b2=WHITE_MAN, d4=WHITE_MAN, e3=RED_MAN, f4=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"a1xc3xe5", "e3xc5", "e3xg5"})

    def test_king_cannot_jump_the_same_piece_twice(self):
        # A loop around one piece would re-cross it; the chain has to stop after one jump.
        board = board_with(c3=RED_KING, d4=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"c3xe5"})

    def test_king_may_circle_back_through_its_origin(self):
        board = board_with(c3=RED_KING, d4=WHITE_MAN, d6=WHITE_MAN, b6=WHITE_MAN, b4=WHITE_MAN)
        self.assertIn("c3xe5xc7xa5xc3", notations(board, RED))

    def test_man_reaching_the_far_rank_stops_jumping(self):
        # A king on d8 could continue over e7; a newly crowned man ends its turn.
        board = board_with(b6=RED_MAN, c7=WHITE_MAN, e7=WHITE_MAN)
        self.assertEqual(notations(board, RED), {"b6xd8"})


class ResolveTests(SimpleTestCase):
    def test_returns_the_matching_move(self):
        move = engine.resolve_move(board_with(c3=RED_MAN, d4=WHITE_MAN), RED, "c3xe5")
        self.assertEqual(move.captures, (Square.from_name("d4"),))

    def assert_rejected(self, board, color, notation, fragment):
        with self.assertRaises(IllegalMoveError) as caught:
            engine.resolve_move(board, color, notation)
        self.assertIn(fragment, str(caught.exception))

    def test_explains_empty_origin(self):
        self.assert_rejected(board_with(c3=RED_MAN), RED, "e3-d4", "no piece")

    def test_explains_opponents_piece(self):
        self.assert_rejected(board_with(c3=RED_MAN, f6=WHITE_MAN), WHITE, "c3-d4", "isn't yours")

    def test_explains_mandatory_capture(self):
        board = board_with(c3=RED_MAN, d4=WHITE_MAN, g3=RED_MAN)
        self.assert_rejected(board, RED, "g3-f4", "must jump")

    def test_explains_incomplete_multi_jump(self):
        board = board_with(a1=RED_MAN, b2=WHITE_MAN, d4=WHITE_MAN)
        self.assert_rejected(board, RED, "a1xc3", "stops too early")

    def test_rejects_backward_step(self):
        self.assert_rejected(board_with(d4=RED_MAN), RED, "d4-c3", "not a legal move")


class ApplyMoveTests(SimpleTestCase):
    def test_moves_piece_removes_captures_and_keeps_input_intact(self):
        board = board_with(a1=RED_MAN, b2=WHITE_MAN, d4=WHITE_MAN)
        move = engine.resolve_move(board, RED, "a1xc3xe5")
        result = engine.apply_move(board, move)
        self.assertEqual(result, board_with(e5=RED_MAN))
        self.assertEqual(board, board_with(a1=RED_MAN, b2=WHITE_MAN, d4=WHITE_MAN))

    def test_crowns_on_the_far_rank(self):
        red = board_with(a7=RED_MAN)
        self.assertEqual(
            engine.apply_move(red, engine.resolve_move(red, RED, "a7-b8")),
            board_with(b8=RED_KING),
        )
        white = board_with(b2=WHITE_MAN)
        self.assertEqual(
            engine.apply_move(white, engine.resolve_move(white, WHITE, "b2-a1")),
            board_with(a1=WHITE_KING),
        )

    def test_king_stays_a_king(self):
        board = board_with(a7=RED_KING)
        self.assertEqual(
            engine.apply_move(board, engine.resolve_move(board, RED, "a7-b8")),
            board_with(b8=RED_KING),
        )
