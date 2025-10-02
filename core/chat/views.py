from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ContactModels, ChatModels, MessageModels
from .serializers import ContactSerializer, ChatSerializer, MessageSerializer
from accounts.models import User

# ======================================================================================================================
class ContactViewSet(viewsets.ModelViewSet):
    queryset = ContactModels.objects.all()
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ContactModels.objects.filter(user=user)

# ======================================================================================================================
class ChatViewSet(viewsets.ModelViewSet):
    queryset = ChatModels.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ChatModels.objects.filter(participants=user)

# ======================================================================================================================
class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        receiver_id = self.kwargs.get('receiver')

        if not receiver_id:
            return MessageModels.objects.none()

        # استفاده از id واقعی کاربر
        receiver = get_object_or_404(User, id=receiver_id)

        # برگرداندن تمام پیام‌ها بین کاربر لاگین شده و گیرنده
        return MessageModels.objects.filter(
            sender=user, receiver=receiver
        ) | MessageModels.objects.filter(
            sender=receiver, receiver=user
        )

    def perform_create(self, serializer):
        # فرستنده همیشه کاربر لاگین شده است
        serializer.save(sender=self.request.user)
# ======================================================================================================================