from rest_framework import viewsets
from .models import ContactModels, ChatModels, MessageModels
from .serializers import ContactSerializer, ChatSerializer, MessageSerializer
from rest_framework.permissions import IsAuthenticated
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
    queryset = MessageModels.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        receiver = self.kwargs['receiver']
        return MessageModels.objects.filter(sender=user, receiver=receiver) | MessageModels.objects.filter(sender=receiver, receiver=user)

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
# ======================================================================================================================