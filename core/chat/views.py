from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework import generics
from django.shortcuts import get_object_or_404
from .models import ContactModels, ChatModels, MessageModels,BlockModels,ReportModels
from .serializers import ContactSerializer, AddContactSerializer, ChatSerializer, MessageSerializer,ReportSerializer,BlockSerializer
from accounts.models import User
from django.db.models import Q
from rest_framework.views import APIView
# ======================================================================================================================
class ContactViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return AddContactSerializer
        return ContactSerializer

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return ContactModels.objects.filter(
            user=self.request.user
        ).select_related("contact", "contact__user_profile")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        contact_user = serializer.validated_data["contact_user"]
        display_name = serializer.validated_data["display_name"]

        contact, _ = ContactModels.objects.update_or_create(
            user=request.user,
            contact=contact_user,
            defaults={
                "display_name": display_name,
                "profile": getattr(contact_user, "user_profile", None),
            },
        )
        return Response(
            ContactSerializer(contact, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
# ======================================================================================================================
class SearchUsersView(APIView):
    """چک کردن اینکه یه شماره/ایمیل توی چتیفای هست یا نه، قبل از سیو به‌عنوان مخاطب"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response([])

        users = User.objects.filter(
            Q(email__icontains=query) | Q(phone_number__icontains=query)
        ).exclude(id=request.user.id)[:20]

        my_contact_ids = set(
            ContactModels.objects.filter(user=request.user).values_list("contact_id", flat=True)
        )

        result = []
        for u in users:
            profile = getattr(u, "user_profile", None)
            name = None
            image = None
            if profile:
                name = profile.get_fullname()
                if profile.image:
                    image = request.build_absolute_uri(profile.image.url)
            result.append({
                "id": u.id,
                "email": u.email,
                "phone_number": u.phone_number,
                "name": name or u.email or u.phone_number,
                "profile": image,
                "is_contact": u.id in my_contact_ids,
            })
        return Response(result)
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

        if BlockModels.objects.filter(user=receiver, blocked_user=sender).exists():
            raise DRFPermissionDenied("این کاربر شما را مسدود کرده است.")
        if BlockModels.objects.filter(user=sender, blocked_user=receiver).exists():
            raise DRFPermissionDenied("شما این کاربر را مسدود کرده‌اید.")

        serializer.save(sender=sender, receiver=receiver)
# ======================================================================================================================
class BlockViewSet(viewsets.ModelViewSet):
    serializer_class = BlockSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return BlockModels.objects.filter(user=self.request.user).select_related(
            "blocked_user", "blocked_user__user_profile"
        )

    def create(self, request, *args, **kwargs):
        blocked_id = request.data.get("blocked_user")
        if not blocked_id:
            return Response({"detail": "کاربر مشخص نشده."}, status=400)
        if int(blocked_id) == request.user.id:
            return Response({"detail": "نمی‌تونی خودتو بلاک کنی."}, status=400)

        blocked_user = get_object_or_404(User, id=blocked_id)
        obj, created = BlockModels.objects.get_or_create(user=request.user, blocked_user=blocked_user)
        return Response(
            self.get_serializer(obj).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
# ======================================================================================================================
class UnblockByUserView(APIView):
    """DELETE /chat/blocks/unblock/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        deleted, _ = BlockModels.objects.filter(user=request.user, blocked_user_id=user_id).delete()
        if not deleted:
            return Response({"detail": "این کاربر بلاک نبود."}, status=404)
        return Response(status=204)
# ======================================================================================================================
class BlockStatusView(APIView):
    """GET /chat/blocks/status/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        i_blocked_them = BlockModels.objects.filter(user=request.user, blocked_user_id=user_id).exists()
        they_blocked_me = BlockModels.objects.filter(user_id=user_id, blocked_user=request.user).exists()
        return Response({"i_blocked_them": i_blocked_them, "they_blocked_me": they_blocked_me})
# ======================================================================================================================
class ReportUserView(generics.CreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)
# ======================================================================================================================