from rest_framework import serializers
from .models import ContactModels, ChatModels, MessageModels
from accounts.models import User
# ======================================================================================================================
class ContactSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source="contact.username", read_only=True)
    contact_email = serializers.EmailField(source="contact.email", read_only=True)

    class Meta:
        model = ContactModels
        fields = ['user', 'contact', 'contact_name', 'contact_email']

# ======================================================================================================================
class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatModels
        fields = ['id', 'participants', 'last_message', 'created_date', 'updated_date']

    def get_last_message(self, obj):
        if obj.last_message:
            return MessageSerializer(obj.last_message).data
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