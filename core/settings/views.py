import json
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from .models import UserSettings
from .serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    UserSettingsSerializer,
)
from chat.models import MessageModels
User = get_user_model()
# ======================================================================================================================
class UserSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj, _created = UserSettings.objects.get_or_create(user=self.request.user)
        return obj

    def patch(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)
# ======================================================================================================================
class ChangePasswordView(APIView):
    """POST /settings/change-password/  {old_password, new_password}"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "رمز عبور با موفقیت تغییر کرد."}, status=status.HTTP_200_OK)
# ======================================================================================================================
class DeleteAccountView(APIView):


    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.delete()
        return Response({"detail": "حساب کاربری حذف شد."}, status=status.HTTP_200_OK)
# ======================================================================================================================
def _safe_size(field_file):
    try:
        return field_file.size if field_file else 0
    except (OSError, ValueError):
        return 0
TYPE_LABELS = {
    "image": "عکس‌ها",
    "file": "فایل‌ها",
    "voice": "پیام‌های صوتی",
    "video_note": "ویدیو‌نوت‌ها",
}
# ======================================================================================================================
class StorageUsageSummaryView(APIView):
    """GET /settings/storage-usage/ -- خلاصه‌ی فضای واقعی مصرف‌شده، به تفکیک نوع"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        messages = MessageModels.objects.filter(Q(sender=user) | Q(receiver=user)).only(
            "message_type", "image", "file"
        )

        breakdown = {k: 0 for k in TYPE_LABELS}
        counts = {k: 0 for k in TYPE_LABELS}

        for msg in messages:
            if msg.message_type == "image" and msg.image:
                breakdown["image"] += _safe_size(msg.image)
                counts["image"] += 1
            elif msg.message_type in ("file", "voice", "video_note") and msg.file:
                breakdown[msg.message_type] += _safe_size(msg.file)
                counts[msg.message_type] += 1

        total = sum(breakdown.values())

        return Response({
            "totalBytes": total,
            "breakdown": [
                {"type": t, "label": TYPE_LABELS[t], "bytes": breakdown[t], "count": counts[t]}
                for t in TYPE_LABELS
            ],
        }, status=status.HTTP_200_OK)
# ======================================================================================================================
class StorageItemsListView(APIView):
    """GET /settings/storage-usage/items/?type=image -- لیست تک‌تک فایل‌ها برای مدیریت/حذف"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        msg_type = request.query_params.get("type", "image")
        if msg_type not in TYPE_LABELS:
            return Response({"detail": "نوع نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        messages = (
            MessageModels.objects.filter(Q(sender=user) | Q(receiver=user), message_type=msg_type)
            .select_related("sender", "sender__user_profile", "receiver", "receiver__user_profile")
            .order_by("-created_date")
        )

        items = []
        for msg in messages:
            field_file = msg.image if msg_type == "image" else msg.file
            if not field_file:
                continue
            other_user = msg.receiver if msg.sender_id == user.id else msg.sender
            other_profile = getattr(other_user, "user_profile", None)
            items.append({
                "messageId": msg.id,
                "url": field_file.url,
                "fileName": msg.file_name,
                "bytes": _safe_size(field_file),
                "createdAt": msg.created_date,
                "withUser": other_profile.get_fullname() if other_profile else other_user.email,
            })

        return Response(items, status=status.HTTP_200_OK)
# ======================================================================================================================
class DeleteStorageItemView(APIView):
    """DELETE /settings/storage-usage/items/<message_id>/ -- فقط فایل ضمیمه پاک می‌شه، متن پیام می‌مونه"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id):
        user = request.user
        try:
            msg = MessageModels.objects.get(id=message_id)
        except MessageModels.DoesNotExist:
            return Response({"detail": "پیام پیدا نشد."}, status=status.HTTP_404_NOT_FOUND)

        if user.id not in (msg.sender_id, msg.receiver_id):
            return Response({"detail": "اجازه نداری."}, status=status.HTTP_403_FORBIDDEN)

        freed = 0
        if msg.image:
            freed += _safe_size(msg.image)
            msg.image.delete(save=False)
        if msg.file:
            freed += _safe_size(msg.file)
            msg.file.delete(save=False)
        msg.file_name = None
        msg.save(update_fields=["image", "file", "file_name"])

        return Response({"freedBytes": freed}, status=status.HTTP_200_OK)
# ======================================================================================================================
class BackupChatsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        messages = (
            MessageModels.objects.filter(Q(sender=user) | Q(receiver=user))
            .select_related("sender", "receiver")
            .order_by("created_date")
        )

        data = {
            "exportedAt": timezone.now().isoformat(),
            "user": user.email or user.phone_number,
            "messageCount": messages.count(),
            "messages": [
                {
                    "id": m.id,
                    "from": m.sender.email or m.sender.phone_number,
                    "to": m.receiver.email or m.receiver.phone_number,
                    "type": m.message_type,
                    "text": m.text,
                    "fileName": m.file_name,
                    "createdAt": m.created_date.isoformat(),
                }
                for m in messages
            ],
        }

        settings_obj, _ = UserSettings.objects.get_or_create(user=user)
        settings_obj.last_backup_date = timezone.now()
        settings_obj.save(update_fields=["last_backup_date"])

        payload = json.dumps(data, ensure_ascii=False, indent=2)
        filename = f"chatify-backup-{timezone.now().strftime('%Y-%m-%d')}.json"

        response = HttpResponse(payload, content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
# ======================================================================================================================