from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import ContactModels, ChatModels, MessageModels
from .serializers import ContactSerializer, ChatSerializer, MessageSerializer
from accounts.models import User
from django.db.models import Q
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
        return ChatModels.objects.filter(participants=user).prefetch_related("participants")
# ======================================================================================================================
class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        receiver_id = self.kwargs.get('receiver')
        if not receiver_id:
            return MessageModels.objects.none()

        receiver = get_object_or_404(User, id=receiver_id)
        return MessageModels.objects.filter(
            Q(sender=user, receiver=receiver) | Q(sender=receiver, receiver=user)
        ).order_by("-created_date")

    def perform_create(self, serializer):
        sender = self.request.user
        receiver = get_object_or_404(User, id=self.kwargs.get("receiver"))
        serializer.save(sender=sender, receiver=receiver)
# ======================================================================================================================