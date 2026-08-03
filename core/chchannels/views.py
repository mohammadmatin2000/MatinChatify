from rest_framework import viewsets, status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import ChannelModels, ChannelMember, ChannelMessage
from .serializers import (
    ChannelSerializer, ChannelMemberSerializer, ChannelMessageSerializer,
    JoinChannelSerializer, AddChannelMemberSerializer,
)
# ======================================================================================================================
class ChannelViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # کانال‌هایی که کاربر عضوشونه
        return ChannelModels.objects.filter(members__user=self.request.user).distinct()

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        channel = serializer.save(owner=self.request.user)
        ChannelMember.objects.create(channel=channel, user=self.request.user, role="admin")

    @action(detail=True, methods=["get"], url_path="members")
    def list_members(self, request, pk=None):
        channel = self.get_object()
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