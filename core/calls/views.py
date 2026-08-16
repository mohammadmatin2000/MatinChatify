from django.db import models as db_models
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import CallLogModel, GroupCallLogModel
from .serializers import CallLogSerializer, GroupCallLogSerializer
# ======================================================================================================================
# لیست و ثبت تماس‌های خصوصی
class CallLogListCreateView(generics.ListCreateAPIView):
    serializer_class = CallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return CallLogModel.objects.filter(
            db_models.Q(caller=user) | db_models.Q(receiver=user)
        )

    def perform_create(self, serializer):
        serializer.save(caller=self.request.user)
# ======================================================================================================================
# جزئیات یک تماس خصوصی خاص
# ✅ FIX: قبلاً RetrieveAPIView بود که فقط GET داشت، برای همین درخواست
# DELETE از فرانت با 405 Method Not Allowed رد می‌شد. الان
# RetrieveDestroyAPIView شده که DELETE رو هم پشتیبانی می‌کنه. get_queryset
# همچنان فقط تماس‌های خودِ کاربر (caller یا receiver) رو برمی‌گردونه، پس
# کسی نمی‌تونه تماس بین دو نفر دیگه رو حذف کنه.
class CallLogDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = CallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return CallLogModel.objects.filter(
            db_models.Q(caller=user) | db_models.Q(receiver=user)
        )
# ======================================================================================================================
# لیست و ثبت تماس‌های گروهی
class GroupCallLogListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupCallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # فقط تماس‌های گروه‌هایی که کاربر عضوشونه
        return GroupCallLogModel.objects.filter(group__members__user=user).distinct()

    def perform_create(self, serializer):
        serializer.save(initiator=self.request.user)
# ======================================================================================================================
class GroupCallLogDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = GroupCallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return GroupCallLogModel.objects.filter(group__members__user=user).distinct()
# ======================================================================================================================