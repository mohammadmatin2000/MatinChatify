from rest_framework import viewsets, permissions
from .models import Group, GroupMember, GroupMessages
from .serializers import GroupSerializer, GroupMemberSerializer, GroupMessageSerializer
# ======================================================================================================================
class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
# ======================================================================================================================
class GroupMemberViewSet(viewsets.ModelViewSet):
    queryset = GroupMember.objects.all()
    serializer_class = GroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]
# ======================================================================================================================
class GroupMessageViewSet(viewsets.ModelViewSet):
    queryset = GroupMessages.objects.all()
    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
# ======================================================================================================================