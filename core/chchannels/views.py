from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import ChannelModels, ChannelMember, ChannelMessage
from .serializers import (
    ChannelSerializer, ChannelMemberSerializer, ChannelMessageSerializer,
    JoinChannelSerializer, AddChannelMemberSerializer, UpdateMemberRoleSerializer,
)
# ======================================================================================================================
class ChannelViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChannelModels.objects.filter(members__user=self.request.user).distinct()

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        channel = serializer.save(owner=self.request.user)
        ChannelMember.objects.create(channel=channel, user=self.request.user, role="admin")

    def perform_destroy(self, instance):
        if instance.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("فقط مالک کانال می‌تونه حذفش کنه.")
        instance.delete()

    # ✅ فقط ادمین می‌تونه لیست کامل اعضا رو ببینه
    @action(detail=True, methods=["get"], url_path="members")
    def list_members(self, request, pk=None):
        channel = self.get_object()
        my_membership = channel.members.filter(user=request.user).first()
        if not my_membership or my_membership.role != "admin":
            return Response(
                {"detail": "فقط ادمین کانال می‌تونه لیست اعضا رو ببینه."},
                status=status.HTTP_403_FORBIDDEN,
            )
        members = channel.members.select_related("user", "user__user_profile")
        return Response(ChannelMemberSerializer(members, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="add-member")
    def add_member(self, request, pk=None):
        channel = self.get_object()
        my_membership = channel.members.filter(user=request.user).first()
        if not my_membership or my_membership.role != "admin":
            return Response({"detail": "فقط ادمین می‌تونه عضو اضافه کنه."}, status=status.HTTP_403_FORBIDDEN)

        serializer = AddChannelMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user = serializer.validated_data["target_user"]
        role = serializer.validated_data["role"]

        member, _ = ChannelMember.objects.get_or_create(
            channel=channel, user=target_user, defaults={"role": role}
        )
        return Response(
            ChannelMemberSerializer(member, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="join")
    def join(self, request):
        serializer = JoinChannelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_code = serializer.validated_data["invite_code"]

        channel = get_object_or_404(ChannelModels, invite_code=invite_code)
        if not channel.is_public:
            return Response({"detail": "این کانال خصوصیه، فقط با دعوت ادمین می‌تونی جوین بشی."},
                             status=status.HTTP_403_FORBIDDEN)

        member, created = ChannelMember.objects.get_or_create(
            channel=channel, user=request.user, defaults={"role": "subscriber"}
        )
        return Response(
            ChannelSerializer(channel, context={"request": request}).data,
            status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        channel = self.get_object()
        if channel.owner == request.user:
            return Response({"detail": "مالک کانال نمی‌تونه ترکش کنه، کانال رو حذف کن."},
                             status=status.HTTP_400_BAD_REQUEST)
        ChannelMember.objects.filter(channel=channel, user=request.user).delete()
        return Response({"detail": "از کانال خارج شدی."}, status=status.HTTP_200_OK)
# ======================================================================================================================
class ChannelMessageViewSet(generics.ListAPIView):
    serializer_class = ChannelMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        channel_id = self.kwargs.get("channel_id")
        return ChannelMessage.objects.filter(
            channel_id=channel_id, channel__members__user=self.request.user
        ).select_related("sender")
# ======================================================================================================================
class ChannelMemberRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, channel_id, member_id):
        channel = get_object_or_404(ChannelModels, id=channel_id)
        my_membership = channel.members.filter(user=request.user).first()
        if not my_membership or my_membership.role != "admin":
            return Response({"detail": "فقط ادمین می‌تونه نقش اعضا رو تغییر بده."}, status=status.HTTP_403_FORBIDDEN)

        target_member = get_object_or_404(ChannelMember, id=member_id, channel=channel)
        if target_member.user == channel.owner:
            return Response({"detail": "نقش مالک کانال قابل تغییر نیست."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UpdateMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_member.role = serializer.validated_data["role"]
        target_member.save(update_fields=["role"])
        return Response(ChannelMemberSerializer(target_member, context={"request": request}).data)
# ======================================================================================================================
class ChannelMemberRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, channel_id, member_id):
        channel = get_object_or_404(ChannelModels, id=channel_id)
        my_membership = channel.members.filter(user=request.user).first()
        if not my_membership or my_membership.role != "admin":
            return Response({"detail": "فقط ادمین می‌تونه عضو رو حذف کنه."}, status=status.HTTP_403_FORBIDDEN)

        target_member = get_object_or_404(ChannelMember, id=member_id, channel=channel)
        if target_member.user == channel.owner:
            return Response({"detail": "مالک کانال قابل حذف نیست."}, status=status.HTTP_400_BAD_REQUEST)

        target_member.delete()
        return Response({"detail": "عضو از چنل حذف شد."}, status=status.HTTP_200_OK)
# ======================================================================================================================