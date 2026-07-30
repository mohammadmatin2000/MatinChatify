from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Group, GroupMember, GroupMessages
from .serializers import GroupSerializer, GroupMemberSerializer, GroupMessageSerializer
# ======================================================================================================================
def is_group_admin(group, user):
    if group.owner_id == user.id:
        return True
    return GroupMember.objects.filter(group=group, user=user, role="admin").exists()
# ======================================================================================================================
# گروه‌ها
class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # ✅ برای آپلود عکس گروه

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        group = self.get_object()
        # ✅ فقط ادمین (سازنده یا نقش admin) اجازه‌ی ویرایش اسم/عکس/توضیحات رو داره
        if not is_group_admin(group, self.request.user):
            raise PermissionDenied("فقط ادمین گروه می‌تواند اطلاعات گروه را ویرایش کند.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("فقط سازنده‌ی گروه می‌تواند آن را حذف کند.")
        instance.delete()
# ======================================================================================================================
# اعضای گروه
class GroupMemberViewSet(viewsets.ModelViewSet):
    serializer_class = GroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = GroupMember.objects.select_related("user", "user__user_profile", "group")
        # ✅ فیلتر بر اساس گروه: /groups/members/?group=<id>
        group_id = self.request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    def perform_create(self, serializer):
        # اگه فرانت "user" نفرستاده باشه (مثلاً موقع افزودن خود سازنده به گروه)، خودمون می‌ذاریم
        if "user" not in serializer.validated_data:
            serializer.save(user=self.request.user)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        # ✅ فقط ادمین گروه یا خود عضو می‌تونه عضویت رو حذف کنه (ترک گروه / اخراج عضو)
        if not (is_group_admin(instance.group, self.request.user) or instance.user_id == self.request.user.id):
            raise PermissionDenied("اجازه‌ی حذف این عضو را ندارید.")
        instance.delete()
# ======================================================================================================================
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
# ======================================================================================================================