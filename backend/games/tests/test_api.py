from unittest import mock

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from games import engine, services
from games.exceptions import NotYourTurn
from games.models import Game, GamePlayer, Invitation, Move, Piece

User = get_user_model()


def start_game(red, white) -> Game:
    invitation = Invitation.objects.create(inviter=red, invitee=white, inviter_color="red")
    return services.accept_invitation(invitation.pk).game


def set_position(game: Game, **pieces: int) -> None:
    """Replace the board, e.g. set_position(game, c3=RED_MAN, d4=WHITE_MAN)."""
    game.pieces.all().delete()
    for name, code in pieces.items():
        square = engine.Square.from_name(name)
        Piece.objects.create(
            game=game,
            row=square.row,
            column=square.col,
            color=engine.color_of(code),
            is_king=engine.is_king(code),
        )


class GameApiTestCase(APITestCase):
    def setUp(self):
        self.red = User.objects.create_user("red_player", password="x")
        self.white = User.objects.create_user("white_player", password="x")
        self.outsider = User.objects.create_user("outsider", password="x")
        self.game = start_game(self.red, self.white)
        self.url = f"/api/games/{self.game.pk}/"
        self.moves_url = f"{self.url}moves/"
        self.client.force_authenticate(self.red)

    def as_user(self, user) -> APIClient:
        client = APIClient()
        client.force_authenticate(user)
        return client

    def play(self, user, notation):
        return self.as_user(user).post(self.moves_url, {"notation": notation})


class BoardRepresentationTests(GameApiTestCase):
    def test_new_game_board_matches_the_engine(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["board"], engine.initial_board())
        self.assertEqual(self.game.pieces.count(), 24)

    def test_response_reports_viewer_perspective(self):
        red_view = self.client.get(self.url).data
        white_view = self.as_user(self.white).get(self.url).data
        self.assertEqual((red_view["your_color"], red_view["is_your_turn"]), ("red", True))
        self.assertEqual((white_view["your_color"], white_view["is_your_turn"]), ("white", False))


class TurnEnforcementTests(GameApiTestCase):
    def test_active_player_can_move_and_turn_passes(self):
        response = self.play(self.red, "c3-d4")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["current_turn"], "white")
        self.assertEqual(response.data["move_count"], 1)
        self.assertEqual(response.data["moves"][0]["notation"], "c3-d4")
        d4 = engine.Square.from_name("d4")
        self.assertEqual(response.data["board"][d4.row][d4.col], engine.RED_MAN)

    def test_waiting_player_gets_403_and_board_is_unchanged(self):
        response = self.play(self.white, "b6-a5")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "not_your_turn")
        self.assertEqual(Move.objects.count(), 0)

    def test_same_player_cannot_move_twice(self):
        self.play(self.red, "c3-d4")
        response = self.play(self.red, "e3-f4")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_service_rechecks_turn_after_the_permission_passed(self):
        # Simulates a request that passed the permission check just before a rival
        # request played: the check under the lock is what must reject it.
        services.play_move(self.game.pk, self.red, "c3-d4")
        with self.assertRaises(NotYourTurn):
            services.play_move(self.game.pk, self.red, "e3-f4")

    def test_outsider_cannot_view_or_move(self):
        client = self.as_user(self.outsider)
        self.assertEqual(client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        response = client.post(self.moves_url, {"notation": "c3-d4"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Move.objects.count(), 0)

    def test_anonymous_request_gets_401(self):
        self.client.force_authenticate(None)
        response = self.client.post(self.moves_url, {"notation": "c3-d4"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_game_gets_404_in_the_standard_shape(self):
        response = self.client.get("/api/games/999999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["code"], "not_found")


class MoveValidationTests(GameApiTestCase):
    def test_malformed_notation_is_a_field_error(self):
        for bad in ("", "c3", "c3 d4", "z9-a1", "c3-d5"):
            with self.subTest(bad=bad):
                response = self.play(self.red, bad)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("notation", response.data["errors"])

    def test_missing_notation_is_a_field_error(self):
        response = self.client.post(self.moves_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("notation", response.data["errors"])

    def test_illegal_but_well_formed_move_is_rejected(self):
        response = self.play(self.red, "a1-b2")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "illegal_move")

    def test_cannot_move_opponents_piece(self):
        response = self.play(self.red, "b6-a5")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("isn't yours", response.data["detail"])

    def test_mandatory_capture_is_enforced(self):
        set_position(self.game, c3=engine.RED_MAN, d4=engine.WHITE_MAN, g3=engine.RED_MAN)
        response = self.play(self.red, "g3-f4")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must jump", response.data["detail"])


class GamePlayTests(GameApiTestCase):
    def test_capture_deletes_the_jumped_piece_row(self):
        set_position(self.game, c3=engine.RED_MAN, d4=engine.WHITE_MAN, h8=engine.WHITE_MAN)
        response = self.play(self.red, "c3xe5")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.game.pieces.filter(color="white").count(), 1)
        self.assertEqual(response.data["moves"][0]["captured_count"], 1)

    def test_crowning_persists_and_is_recorded(self):
        set_position(self.game, a7=engine.RED_MAN, h2=engine.WHITE_MAN)
        response = self.play(self.red, "a7-b8")
        self.assertTrue(response.data["moves"][0]["crowned"])
        self.assertTrue(self.game.pieces.get(color="red").is_king)

    def test_capturing_the_last_piece_wins_and_updates_records(self):
        set_position(self.game, c3=engine.RED_MAN, d4=engine.WHITE_MAN)
        response = self.play(self.red, "c3xe5")
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["winner"]["username"], "red_player")
        self.assertEqual(response.data["end_reason"], "no_moves")
        self.red.profile.refresh_from_db()
        self.white.profile.refresh_from_db()
        self.assertEqual((self.red.profile.wins, self.white.profile.losses), (1, 1))

    def test_blocking_every_enemy_move_wins(self):
        # A white man on rank 1 has nowhere to go, so White is stuck once Red moves.
        set_position(self.game, a1=engine.WHITE_MAN, c3=engine.RED_MAN)
        response = self.play(self.red, "c3-d4")
        self.assertEqual(response.data["status"], "completed")

    def test_no_moves_allowed_after_the_game_ends(self):
        set_position(self.game, c3=engine.RED_MAN, d4=engine.WHITE_MAN)
        self.play(self.red, "c3xe5")
        for user in (self.red, self.white):
            response = self.play(user, "e5-d6")
            self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
            self.assertEqual(response.data["code"], "game_finished")

    def test_quiet_limit_is_a_draw(self):
        set_position(self.game, a1=engine.RED_KING, h8=engine.WHITE_KING)
        Game.objects.filter(pk=self.game.pk).update(quiet_plies=79)
        response = self.play(self.red, "a1-b2")
        self.assertEqual(response.data["status"], "completed")
        self.assertIsNone(response.data["winner"])
        self.assertEqual(response.data["end_reason"], "draw_rule")
        self.red.profile.refresh_from_db()
        self.assertEqual(self.red.profile.draws, 1)

    def test_man_move_resets_the_quiet_counter(self):
        set_position(self.game, a3=engine.RED_MAN, h8=engine.WHITE_KING)
        Game.objects.filter(pk=self.game.pk).update(quiet_plies=50)
        self.play(self.red, "a3-b4")
        self.game.refresh_from_db()
        self.assertEqual(self.game.quiet_plies, 0)

    def test_resign_awards_opponent_even_off_turn(self):
        response = self.as_user(self.white).post(f"{self.url}resign/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["winner"]["username"], "red_player")
        self.assertEqual(response.data["end_reason"], "resignation")

    def test_outsider_cannot_resign(self):
        response = self.as_user(self.outsider).post(f"{self.url}resign/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.game.refresh_from_db()
        self.assertEqual(self.game.status, "active")

    def test_cannot_resign_twice(self):
        self.client.post(f"{self.url}resign/")
        self.assertEqual(self.client.post(f"{self.url}resign/").status_code, 409)
        self.red.profile.refresh_from_db()
        self.assertEqual(self.red.profile.losses, 1)

    def test_move_history_endpoint(self):
        self.play(self.red, "c3-d4")
        response = self.client.get(self.moves_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["player"], "red_player")


class TransactionSafetyTests(GameApiTestCase):
    def test_failure_partway_through_a_move_rolls_everything_back(self):
        before = self.client.get(self.url).data["board"]
        api = APIClient(raise_request_exception=False)
        api.force_authenticate(self.red)
        with mock.patch.object(Move.objects, "create", side_effect=RuntimeError("boom")):
            response = api.post(self.moves_url, {"notation": "c3-d4"})
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data["code"], "server_error")
        self.assertNotIn("boom", str(response.data))
        self.assertEqual(self.client.get(self.url).data["board"], before)
        self.game.refresh_from_db()
        self.assertEqual(self.game.current_turn, "red")

    def test_constraint_violation_becomes_409(self):
        with mock.patch.object(Move.objects, "create", side_effect=IntegrityError("dup")):
            response = self.client.post(self.moves_url, {"notation": "c3-d4"})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "move_conflict")


class QueryEfficiencyTests(GameApiTestCase):
    def count_queries(self, url: str) -> int:
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return len(queries)

    def test_game_list_query_count_does_not_grow_with_games(self):
        baseline = self.count_queries("/api/games/")
        for index in range(6):
            opponent = User.objects.create_user(f"rival{index}", password="x")
            start_game(self.red, opponent)
        self.assertEqual(self.count_queries("/api/games/"), baseline)

    def test_game_detail_query_count_does_not_grow_with_moves(self):
        baseline = self.count_queries(self.url)
        for mover, notation in [
            (self.red, "c3-d4"),
            (self.white, "b6-a5"),
            (self.red, "e3-f4"),
            (self.white, "d6-c5"),
        ]:
            self.assertEqual(self.play(mover, notation).status_code, 201, notation)
        self.assertEqual(self.count_queries(self.url), baseline)

    def test_invitation_list_query_count_does_not_grow(self):
        baseline = self.count_queries("/api/invitations/")
        for index in range(5):
            opponent = User.objects.create_user(f"guest{index}", password="x")
            Invitation.objects.create(inviter=self.red, invitee=opponent)
        self.assertEqual(self.count_queries("/api/invitations/"), baseline)


class GameListTests(GameApiTestCase):
    def test_lists_only_the_callers_games(self):
        start_game(self.white, self.outsider)
        response = self.client.get("/api/games/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.game.pk)
        self.assertNotIn("board", response.data["results"][0])

    def test_status_filter(self):
        self.client.post(f"{self.url}resign/")
        self.assertEqual(self.client.get("/api/games/?status=active").data["count"], 0)
        self.assertEqual(self.client.get("/api/games/?status=completed").data["count"], 1)
        self.assertEqual(self.client.get("/api/games/?status=bogus").status_code, 400)


class InvitationApiTests(APITestCase):
    def setUp(self):
        self.ada = User.objects.create_user("ada", password="x")
        self.grace = User.objects.create_user("grace", password="x")
        self.linus = User.objects.create_user("linus", password="x")
        self.client.force_authenticate(self.ada)

    def as_user(self, user) -> APIClient:
        client = APIClient()
        client.force_authenticate(user)
        return client

    def invite(self, username="grace", color="white"):
        return self.client.post(
            "/api/invitations/", {"invitee_username": username, "inviter_color": color}
        )

    def test_invite_then_accept_creates_game_with_requested_seats(self):
        invitation = self.invite().data
        self.assertEqual(invitation["status"], "pending")
        self.assertEqual(invitation["inviter"]["username"], "ada")
        response = self.as_user(self.grace).post(f"/api/invitations/{invitation['id']}/accept/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        game_id = response.data["game"]
        self.assertEqual(GamePlayer.objects.get(game_id=game_id, user=self.ada).color, "white")
        self.assertEqual(GamePlayer.objects.get(game_id=game_id, user=self.grace).color, "red")
        self.assertEqual(Piece.objects.filter(game_id=game_id).count(), 24)

    def test_only_invitee_can_accept_or_decline(self):
        invitation_id = self.invite().data["id"]
        for action in ("accept", "decline"):
            response = self.client.post(f"/api/invitations/{invitation_id}/{action}/")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, action)
        self.assertEqual(Game.objects.count(), 0)

    def test_only_inviter_can_cancel(self):
        invitation_id = self.invite().data["id"]
        client = self.as_user(self.grace)
        response = client.post(f"/api/invitations/{invitation_id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(f"/api/invitations/{invitation_id}/cancel/")
        self.assertEqual(response.data["status"], "cancelled")

    def test_third_party_cannot_see_an_invitation(self):
        invitation_id = self.invite().data["id"]
        client = self.as_user(self.linus)
        self.assertEqual(client.get(f"/api/invitations/{invitation_id}/").status_code, 404)
        self.assertEqual(client.post(f"/api/invitations/{invitation_id}/accept/").status_code, 404)

    def test_cannot_accept_twice(self):
        invitation_id = self.invite().data["id"]
        client = self.as_user(self.grace)
        client.post(f"/api/invitations/{invitation_id}/accept/")
        response = client.post(f"/api/invitations/{invitation_id}/accept/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Game.objects.count(), 1)

    def test_cannot_invite_self(self):
        response = self.invite(username="ADA")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invitee_username", response.data["errors"])

    def test_cannot_invite_unknown_player(self):
        response = self.invite(username="nobody")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invitee_username", response.data["errors"])

    def test_cannot_duplicate_a_pending_invitation_in_either_direction(self):
        self.invite()
        self.assertEqual(self.invite().status_code, status.HTTP_400_BAD_REQUEST)
        response = self.as_user(self.grace).post(
            "/api/invitations/", {"invitee_username": "ada", "inviter_color": "red"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_database_blocks_a_pending_duplicate_that_skips_validation(self):
        Invitation.objects.create(inviter=self.ada, invitee=self.grace)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Invitation.objects.create(inviter=self.grace, invitee=self.ada)

    def test_can_reinvite_after_an_invitation_closes(self):
        invitation_id = self.invite().data["id"]
        self.as_user(self.grace).post(f"/api/invitations/{invitation_id}/decline/")
        self.assertEqual(self.invite().status_code, status.HTTP_201_CREATED)

    def test_rejects_invalid_color(self):
        response = self.invite(color="purple")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inviter_color", response.data["errors"])

    def test_status_filter(self):
        self.invite()
        self.assertEqual(self.client.get("/api/invitations/?status=pending").data["count"], 1)
        self.assertEqual(self.client.get("/api/invitations/?status=accepted").data["count"], 0)
