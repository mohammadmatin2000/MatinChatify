from rest_framework import serializers
from .models import Group,GroupMessages,GroupInvite,GroupMember,GroupAttachment
from accounts.models import User
# ======================================================================================================================
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id','email')
# ======================================================================================================================
class GroupSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    class Meta:
        model = Group
        fields = "__all__"
# ======================================================================================================================
class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = "__all__"
# ======================================================================================================================
class GroupMessageSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    attachments = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = GroupMessages
        fields = "__all__"
# ======================================================================================================================
class GroupInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupInvite
        fields = "__all__"
# ======================================================================================================================
class GroupAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupAttachment
        fields = "__all__"
# ======================================================================================================================