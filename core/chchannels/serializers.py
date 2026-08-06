from rest_framework import serializers
from .models import ChannelModels, ChannelMember, ChannelMessage
from accounts.models import User
# ======================================================================================================================
class ChannelMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    name = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = ChannelMember
        fields = ["id", "user_id", "role", "name", "profile", "joined_date"]

    def get_name(self, obj):
        profile = getattr(obj.user, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.user.email or obj.user.phone_number

    def get_profile(self, obj):
        profile = getattr(obj.user, "user_profile", None)
        if profile and profile.image:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.image.url) if request else profile.image.url
        return None
# ======================================================================================================================
class ChannelSerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = ChannelModels
        fields = [
            "id", "name", "description", "image", "owner",
            "is_public", "invite_code", "members_count", "my_role",
            "created_date",
        ]
        read_only_fields = ["owner", "invite_code"]

    def get_members_count(self, obj):
        return obj.members.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.members.filter(user=request.user).first()
        return membership.role if membership else None
# ======================================================================================================================
class ChannelMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = ChannelMessage
        fields = [
            # ✅ FIX: "meta" اضافه شد — بدون این فیلد، پیام‌های لوکیشن/مخاطب/
            # نظرسنجی موقع ریلود صفحه (که از این سریالایزر REST میان، نه از
            # ChannelConsumer.WebSocket) کاملاً خالی نمایش داده می‌شدن، چون
            # meta اصلاً توی جواب سرور نبود.
            "id", "channel", "sender", "sender_name", "message_type",
            "text", "image", "file", "file_name", "meta",
            "created_date", "updated_date",
        ]
        read_only_fields = ["sender", "channel"]

    def get_sender_name(self, obj):
        profile = getattr(obj.sender, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.sender.email or obj.sender.phone_number
# ======================================================================================================================
class JoinChannelSerializer(serializers.Serializer):
    invite_code = serializers.UUIDField()
# ======================================================================================================================
class AddChannelMemberSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    user_id = serializers.IntegerField(required=False)
    role = serializers.ChoiceField(choices=["admin", "subscriber"], default="subscriber")

    def validate(self, attrs):
        phone_number = attrs.get("phone_number")
        email = attrs.get("email")
        user_id = attrs.get("user_id")

        if not phone_number and not email and not user_id:
            raise serializers.ValidationError("شماره، ایمیل یا کاربر مشخص نشده.")

        target_user = None
        if user_id:
            target_user = User.objects.filter(id=user_id).first()
        elif phone_number:
            target_user = User.objects.filter(phone_number=phone_number).first()
        elif email:
            target_user = User.objects.filter(email=email).first()

        if not target_user:
            raise serializers.ValidationError({"detail": "این کاربر توی چتیفای پیدا نشد."})

        attrs["target_user"] = target_user
        return attrs
# ======================================================================================================================
class UpdateMemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["admin", "subscriber"])
# ======================================================================================================================