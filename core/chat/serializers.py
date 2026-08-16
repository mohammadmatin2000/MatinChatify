from rest_framework import serializers
from .models import ContactModels, ChatModels, MessageModels,BlockModels,ReportModels
from accounts.models import User, Profile
from settings.models import UserSettings
from django.db.models import Q
# ======================================================================================================================
class ContactSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    phone_number = serializers.CharField(source="contact.phone_number", read_only=True)
    contact_email = serializers.EmailField(source="contact.email", read_only=True)
    # ✅ FIX: last_seen قبلاً بی‌قید و شرط از contact.last_seen خونده می‌شد
    # (هیچ چک محدودیتی نداشت). الان SerializerMethodField شده تا
    # last_seen_visibility طرف مقابل رو رعایت کنه.
    last_seen = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    # ✅ NEW: بیوگرافی — قبلاً اصلاً توی این سریالایزر وجود نداشت
    bio = serializers.SerializerMethodField()
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ContactModels
        fields = [
            'id', 'user', 'contact', 'phone_number', 'contact_email',
            'display_name', 'name', 'profile', 'bio', 'last_seen',
        ]

    def get_name(self, obj):
        if obj.display_name:
            return obj.display_name
        profile = getattr(obj.contact, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.contact.email or obj.contact.phone_number

    # ---- helpers مشترک برای چک حریم خصوصی ----
    def _viewer(self):
        request = self.context.get("request")
        return request.user if request else None

    def _target_settings(self, target):
        try:
            return target.settings
        except UserSettings.DoesNotExist:
            return None

    def _can_see(self, visibility, target):
        if visibility == "everyone":
            return True
        if visibility == "nobody":
            return False
        # "contacts": فقط کسی که خودِ target توی کانتکت‌لیستش داره
        viewer = self._viewer()
        if not viewer or not viewer.is_authenticated:
            return False
        return ContactModels.objects.filter(user=target, contact=viewer).exists()

    def get_profile(self, obj):
        target = obj.contact
        profile = getattr(target, "user_profile", None)
        if not profile or not profile.image:
            return None

        settings_obj = self._target_settings(target)
        visibility = settings_obj.photo_visibility if settings_obj else "everyone"
        if not self._can_see(visibility, target):
            return None

        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(profile.image.url)
        return None

    def get_bio(self, obj):
        target = obj.contact
        profile = getattr(target, "user_profile", None)
        if not profile:
            return None

        settings_obj = self._target_settings(target)
        visibility = settings_obj.about_visibility if settings_obj else "everyone"
        if not self._can_see(visibility, target):
            return None

        return profile.bio

    def get_last_seen(self, obj):
        target = obj.contact
        if not target.last_seen:
            return None

        settings_obj = self._target_settings(target)
        visibility = settings_obj.last_seen_visibility if settings_obj else "everyone"
        if not self._can_see(visibility, target):
            return None

        return target.last_seen
# ======================================================================================================================
class AddContactSerializer(serializers.Serializer):
    """
    برای ساخت مخاطب جدید. یا با شماره تلفن (مثل واتساب) یا با
    ایمیل/آیدی کاربر (روش قدیمی جستجو). حداقل یکی از این سه باید بیاد.
    """
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    user_id = serializers.IntegerField(required=False)
    display_name = serializers.CharField(max_length=255)

    def validate(self, attrs):
        phone_number = attrs.get("phone_number")
        email = attrs.get("email")
        user_id = attrs.get("user_id")

        if not phone_number and not email and not user_id:
            raise serializers.ValidationError(
                "شماره، ایمیل یا کاربر مشخص نشده."
            )

        contact_user = None
        if user_id:
            contact_user = User.objects.filter(id=user_id).first()
        elif phone_number:
            contact_user = User.objects.filter(phone_number=phone_number).first()
        elif email:
            contact_user = User.objects.filter(email=email).first()

        if not contact_user:
            raise serializers.ValidationError(
                {"detail": "این کاربر توی چتیفای پیدا نشد."}
            )

        request = self.context.get("request")
        if request and contact_user == request.user:
            raise serializers.ValidationError(
                {"detail": "نمی‌تونی خودتو مخاطب کنی."}
            )

        attrs["contact_user"] = contact_user
        return attrs
# ======================================================================================================================
class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)
    class Meta:
        model = ChatModels
        fields = ['id', 'participants', 'created_date', 'updated_date']
# ======================================================================================================================
class MessageSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField(read_only=True)

    is_read = serializers.SerializerMethodField()

    class Meta:
        model = MessageModels
        fields = [
            'id', 'sender', 'receiver', 'message_type', 'text', 'image',
            'file', 'file_name', 'meta', 'is_read', 'read_at',
            'created_date', 'updated_date', 'last_message',
        ]

    def get_is_read(self, obj):
        if not obj.is_read:
            return False


        def receipts_on(uid):
            try:
                return UserSettings.objects.get(user_id=uid).read_receipts
            except UserSettings.DoesNotExist:
                return True

        return receipts_on(obj.sender_id) and receipts_on(obj.receiver_id)

    def get_last_message(self, obj):
        messages = MessageModels.objects.filter(
            Q(sender=obj.sender, receiver=obj.receiver) | Q(sender=obj.receiver, receiver=obj.sender)
        ).order_by('-created_date')
        last_msg = messages.first()
        if last_msg:
            return last_msg.text
        return None
# ======================================================================================================================
class BlockSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    email = serializers.EmailField(source="blocked_user.email", read_only=True)

    class Meta:
        model = BlockModels
        fields = ["id", "blocked_user", "name", "email", "profile", "created_date"]
        read_only_fields = ["id", "created_date"]

    def get_name(self, obj):
        profile = getattr(obj.blocked_user, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.blocked_user.email or obj.blocked_user.phone_number

    def get_profile(self, obj):
        profile = getattr(obj.blocked_user, "user_profile", None)
        if profile and profile.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(profile.image.url)
        return None
# ======================================================================================================================
class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportModels
        fields = ["id", "reported_user", "reason", "description", "created_date"]
        read_only_fields = ["id", "created_date"]
# ======================================================================================================================