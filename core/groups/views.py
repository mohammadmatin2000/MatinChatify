from rest_framework import viewsets, permissions
from .models import Group, GroupMember, GroupMessages
from .serializers import GroupSerializer, GroupMemberSerializer, GroupMessageSerializer

# گروه‌ها
class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# اعضای گروه
class GroupMemberViewSet(viewsets.ModelViewSet):
    queryset = GroupMember.objects.all()
    serializer_class = GroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # اگه فرانت user نفرستاده باشه (مثلاً موقع افزودن خود سازنده)، خودمون می‌ذاریم
        if "user" not in serializer.validated_data:
            serializer.save(user=self.request.user)
        else:
            serializer.save()

# پیام‌ها بر اساس گروه
class GroupMessageViewSet(viewsets.ModelViewSet):
    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs.get("group_id")
        return GroupMessages.objects.filter(group_id=group_id).order_by("created_date")

    def perform_create(self, serializer):
        group_id = self.kwargs.get("group_id")
        group = Group.objects.get(id=group_id)
        serializer.save(author=self.request.user, group=group)
