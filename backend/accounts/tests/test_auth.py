from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

User = get_user_model()
GOOD_PASSWORD = "correct-horse-battery"


class AuthApiTests(APITestCase):
    def test_register_creates_user_profile_and_token(self):
        response = self.client.post(
            "/api/auth/register/", {"username": "ada", "password": GOOD_PASSWORD}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["username"], "ada")
        self.assertEqual(response.data["user"]["profile"], {"wins": 0, "losses": 0, "draws": 0})
        self.assertTrue(Token.objects.filter(key=response.data["token"]).exists())

    def test_register_never_returns_the_password(self):
        response = self.client.post(
            "/api/auth/register/", {"username": "ada", "password": GOOD_PASSWORD}
        )
        self.assertNotIn(GOOD_PASSWORD, str(response.data))

    def test_register_rejects_weak_password_with_field_error(self):
        response = self.client.post("/api/auth/register/", {"username": "ada", "password": "123"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data["errors"])
        self.assertEqual(response.data["code"], "validation_error")

    def test_register_rejects_username_differing_only_by_case(self):
        User.objects.create_user("Ada", password=GOOD_PASSWORD)
        response = self.client.post(
            "/api/auth/register/", {"username": "ada", "password": GOOD_PASSWORD}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data["errors"])

    def test_login_with_bad_password_is_rejected(self):
        User.objects.create_user("ada", password=GOOD_PASSWORD)
        response = self.client.post("/api/auth/login/", {"username": "ada", "password": "nope"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_succeeds_despite_a_stale_token_header(self):
        User.objects.create_user("ada", password=GOOD_PASSWORD)
        self.client.credentials(HTTP_AUTHORIZATION="Token stale")
        response = self.client.post(
            "/api/auth/login/", {"username": "ada", "password": GOOD_PASSWORD}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_me_requires_a_token(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["code"], "not_authenticated")

    def test_logout_revokes_the_token(self):
        user = User.objects.create_user("ada", password=GOOD_PASSWORD)
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)


class UserSearchTests(APITestCase):
    def setUp(self):
        self.me = User.objects.create_user("ada", password=GOOD_PASSWORD, email="ada@example.com")
        User.objects.create_user("adam", password=GOOD_PASSWORD, email="adam@example.com")
        User.objects.create_user("grace", password=GOOD_PASSWORD)
        self.client.force_authenticate(self.me)

    def test_search_excludes_self_and_hides_email(self):
        response = self.client.get("/api/users/", {"search": "ada"})
        self.assertEqual([u["username"] for u in response.data["results"]], ["adam"])
        self.assertNotIn("email", response.data["results"][0])

    def test_search_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/users/").status_code, 401)
