from rest_framework import serializers
from .models import Group, GroupMessages, GroupMember
from accounts.models import User

# ======================================================================================================================
# ✅ سریالایزر کاربر با اسم و عکس پروفایل (برای نمایش کامل صاحب گروه / اعضا)
class GroupUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "name", "image")

    def get_name(self, obj):
        profile = getattr(obj, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.email

    def get_image(self, obj):
        profile = getattr(obj, "user_profile", None)
        if profile and profile.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(profile.image.url)
            return profile.image.url
        return None
# ======================================================================================================================
# گروه
class GroupSerializer(serializers.ModelSerializer):
    owner = GroupUserSerializer(read_only=True)
    members_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id", "name", "owner", "description", "avatar",
            "is_active", "created_date", "updated_date",
            "members_count", "my_role",
        ]
        read_only_fields = ["owner", "is_active", "created_date", "updated_date"]

    def get_members_count(self, obj):
        return obj.members.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.owner_id == request.user.id:
            return "admin"
        membership = obj.members.filter(user=request.user).first()
        return membership.role if membership else None
# ======================================================================================================================
# عضویت در گروه
class GroupMemberSerializer(serializers.ModelSerializer):
    # ✅ برای نوشتن (POST) فقط آیدی کاربر لازمه
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    # ✅ برای خواندن، اطلاعات کامل کاربر (اسم/عکس/ایمیل) برگردونده می‌شه
    user_detail = GroupUserSerializer(source="user", read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "user", "user_detail", "group", "role", "joined_date"]
# ======================================================================================================================
# پیام گروه
class GroupMessageSerializer(serializers.ModelSerializer):
    author = GroupUserSerializer(read_only=True)

    class Meta:
        model = GroupMessages
        fields = "__all__"
# ======================================================================================================================