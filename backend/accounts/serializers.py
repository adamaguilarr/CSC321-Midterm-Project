from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import PlayerProfile

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    """The only user data other players are allowed to see."""

    class Meta:
        model = User
        fields = ("id", "username")
        read_only_fields = fields


class PlayerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProfile
        fields = ("wins", "losses", "draws")
        read_only_fields = fields


class CurrentUserSerializer(serializers.ModelSerializer):
    profile = PlayerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "profile")
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate(self, attrs: dict) -> dict:
        candidate = User(username=attrs["username"], email=attrs.get("email", ""))
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data: dict):
        return User.objects.create_user(**validated_data)
