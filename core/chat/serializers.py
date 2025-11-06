from rest_framework import serializers
from .models import ContactModels, ChatModels, MessageModels
from accounts.models import User,Profile
from django.db.models import Q
# ======================================================================================================================
class ContactSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    contact_email = serializers.EmailField(source="contact.email", read_only=True)
    profile = serializers.SerializerMethodField()
    class Meta:
        model = ContactModels
        fields = ['user', 'contact', 'contact_email', 'name','profile']
    def get_name(self, obj):
        profile = getattr(obj.contact, "user_profile", None)
        if profile and (profile.first_name or profile.last_name):
            return profile.get_fullname()
        return obj.contact.email
    def get_profile(self, obj):
        profile = getattr(obj.contact, "user_profile", None)
        if profile and profile.image:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.image.url)
        return None
# ======================================================================================================================
class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True)
    class Meta:
        model = ChatModels
        fields = ['id', 'participants','created_date', 'updated_date']
# ======================================================================================================================
class MessageSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MessageModels
        fields = ['id', 'sender', 'receiver', 'text', 'image', 'created_date', 'updated_date', 'last_message']

    def get_last_message(self, obj):
        # آخرین پیام بین این دو کاربر
        messages = MessageModels.objects.filter(
            Q(sender=obj.sender, receiver=obj.receiver) | Q(sender=obj.receiver, receiver=obj.sender)
        ).order_by('-created_date')
        last_msg = messages.first()
        if last_msg:
            return last_msg.text
        return None
# ======================================================================================================================