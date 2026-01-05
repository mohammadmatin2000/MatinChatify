from rest_framework import serializers
from .models import Group, GroupMessages, GroupMember
from accounts.models import User

# کاربر
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id','email')

# گروه
class GroupSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    class Meta:
        model = Group
        fields = "__all__"

# عضویت در گروه
class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = GroupMember
        fields = "__all__"

# پیام گروه
class GroupMessageSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = GroupMessages
        fields = "__all__"
