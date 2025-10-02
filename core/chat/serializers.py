from rest_framework import serializers
from .models import ContactModels, ChatModels, MessageModels
from accounts.models import User
# ======================================================================================================================
class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactModels
        fields = ['user', 'contact']
# ======================================================================================================================
class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.SlugRelatedField(slug_field="email", queryset=User.objects.all(), many=True)

    class Meta:
        model = ChatModels
        fields = ['participants', 'last_message']
# ======================================================================================================================
class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SlugRelatedField(slug_field="email", queryset=User.objects.all())
    receiver = serializers.SlugRelatedField(slug_field="email", queryset=User.objects.all())

    class Meta:
        model = MessageModels
        fields = ['sender', 'receiver', 'text', 'image', 'created_date']
# ======================================================================================================================