from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserSettings, PushSubscription

User = get_user_model()
# ======================================================================================================================
class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = [
            "about_text",
            "two_step_enabled",
            "last_seen_visibility",
            "photo_visibility",
            "about_visibility",
            "read_receipts",
            "online_status_visible",
            "notif_messages",
            "notif_groups",
            "notif_calls",
            "notif_preview",
            "notif_vibrate",
            "sound_enabled",
            "enter_to_send",
            "font_size",
            "chat_wallpaper",
            "last_backup_date",
            "auto_download_wifi",
            "auto_download_mobile",
            "language",
            "updated_date",
        ]
        read_only_fields = ["updated_date", "last_backup_date"]
# ======================================================================================================================
# ✅ FIX: این سریالایزر از ModelSerializer ارث‌بری کرده بود ولی Meta نداشت
# (DRF با AssertionError کرش می‌کرد به محض instantiate شدن)، و فیلدش
# اسمش "key" بود در حالی که views.py دنبال "keys" می‌گشت (KeyError).
# چون این دیتا مستقیم مپ به یه مدل نمی‌شه (keys یه dict تو در توئه که
# شامل p256dh و auth هست)، از Serializer ساده استفاده می‌کنیم نه ModelSerializer.
class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField()
    keys = serializers.DictField()
# ======================================================================================================================
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("رمز عبور فعلی اشتباه است.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
# ======================================================================================================================
class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("رمز عبور اشتباه است.")
        return value
# ======================================================================================================================