from rest_framework import serializers
from .models import CallLogModel, GroupCallLogModel, GroupCallParticipantModel
# ======================================================================================================================
class CallLogSerializer(serializers.ModelSerializer):
    caller_name = serializers.SerializerMethodField()
    caller_image = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    receiver_image = serializers.SerializerMethodField()

    class Meta:
        model = CallLogModel
        fields = [
            "id", "caller", "receiver", "call_type", "status",
            "duration", "started_at",
            "caller_name", "caller_image", "receiver_name", "receiver_image",
        ]
        read_only_fields = ["caller"]

    def get_caller_name(self, obj):
        profile = getattr(obj.caller, "user_profile", None)
        return profile.get_fullname() if profile else obj.caller.email

    def get_caller_image(self, obj):
        profile = getattr(obj.caller, "user_profile", None)
        return profile.image.url if profile and profile.image else None

    def get_receiver_name(self, obj):
        profile = getattr(obj.receiver, "user_profile", None)
        return profile.get_fullname() if profile else obj.receiver.email

    def get_receiver_image(self, obj):
        profile = getattr(obj.receiver, "user_profile", None)
        return profile.image.url if profile and profile.image else None
# ======================================================================================================================
class GroupCallParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupCallParticipantModel
        fields = ["id", "user", "user_name", "joined_at", "left_at"]

    def get_user_name(self, obj):
        profile = getattr(obj.user, "user_profile", None)
        return profile.get_fullname() if profile else obj.user.email
# ======================================================================================================================
class GroupCallLogSerializer(serializers.ModelSerializer):
    initiator_name = serializers.SerializerMethodField()
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_image = serializers.SerializerMethodField()
    participants = GroupCallParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = GroupCallLogModel
        fields = [
            "id", "group", "group_name", "group_image", "initiator", "initiator_name",
            "call_type", "status", "duration", "started_at", "participants",
        ]
        read_only_fields = ["initiator"]

    def get_initiator_name(self, obj):
        profile = getattr(obj.initiator, "user_profile", None)
        return profile.get_fullname() if profile else obj.initiator.email

    def get_group_image(self, obj):
        avatar = getattr(obj.group, "avatar", None)
        return avatar.url if avatar else None
# ======================================================================================================================