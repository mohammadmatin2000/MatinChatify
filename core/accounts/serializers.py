from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.encoding import smart_str
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.tokens import default_token_generator

User = get_user_model()


# ======================================================================================================================
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("id", "email", "password", "confirm_password")

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "رمزهای عبور مطابقت ندارند"}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password", None)
        user = User.objects.create_user(
            email=validated_data["email"], password=validated_data["password"]
        )
        user.is_verified = False
        user.save()
        return user


# ======================================================================================================================
class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("کاربری با این ایمیل وجود ندارد.")
        return value


# ======================================================================================================================
class SetNewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        try:
            uid = urlsafe_base64_decode(attrs["uidb64"]).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("لینک فعال‌سازی نامعتبر است.")

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError("توکن منقضی شده یا نامعتبر است.")

        attrs["user"] = user
        return attrs

    def save(self):
        password = self.validated_data["password"]
        user = self.validated_data["user"]
        user.set_password(password)
        user.save()
        return user


# ======================================================================================================================
class ActivationSerializer(serializers.Serializer):
    token = serializers.CharField()
    uidb64 = serializers.CharField()

    def validate(self, attrs):
        token = attrs.get("token")
        uidb64 = attrs.get("uidb64")
        try:
            id = smart_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=id)
            if not PasswordResetTokenGenerator().check_token(user, token):
                raise serializers.ValidationError("لینک فعال‌سازی نامعتبر است.")
            attrs["user"] = user
            return attrs
        except Exception:
            raise serializers.ValidationError("خطا در فعال‌سازی.")

    def save(self):
        user = self.validated_data["user"]
        user.is_active = True
        user.save()
        return user


# ======================================================================================================================