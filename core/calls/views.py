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
class CallLogDetailView(generics.RetrieveAPIView):
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
# جزئیات یک تماس گروهی خاص (شامل لیست شرکت‌کنندگان)
class GroupCallLogDetailView(generics.RetrieveAPIView):
    serializer_class = GroupCallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return GroupCallLogModel.objects.filter(group__members__user=user).distinct()
# ======================================================================================================================