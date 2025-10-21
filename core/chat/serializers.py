from rest_framework import serializers
from .models import ContactModels, ChatModels, MessageModels
from accounts.models import User,Profile
# ======================================================================================================================
class ContactSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    contact_email = serializers.EmailField(source="contact.email", read_only=True)

    class Meta:
        model = ContactModels
        fields = ['user', 'contact', 'contact_email', 'name']

    def get_name(self, obj):
        profile = getattr(obj.contact, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.contact.email
# ======================================================================================================================
class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatModels
        fields = ['id', 'participants', 'last_message', 'created_date', 'updated_date']

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_date").first()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None
# ======================================================================================================================
class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    receiver = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    created_date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S.%fZ", read_only=True)
    class Meta:
        model = MessageModels
        fields = ['id', 'sender', 'receiver', 'text', 'image', 'created_date', 'updated_date']
# ======================================================================================================================