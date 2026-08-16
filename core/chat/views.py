from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework import generics
from django.shortcuts import get_object_or_404
from .models import ContactModels, ChatModels, MessageModels,BlockModels,HiddenConversation
from .serializers import (ContactSerializer, AddContactSerializer, ChatSerializer,
                          MessageSerializer,ReportSerializer,BlockSerializer)
from accounts.models import User
from settings.models import UserSettings
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
class ConversationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        sent_to_ids = MessageModels.objects.filter(sender=user).values_list("receiver_id", flat=True)
        received_from_ids = MessageModels.objects.filter(receiver=user).values_list("sender_id", flat=True)
        partner_ids = set(sent_to_ids) | set(received_from_ids)

        if not partner_ids:
            return Response([])

        # نگاشت partner_id -> زمانی که کاربر این چت رو پاک/مخفی کرده
        hidden_map = {
            h.partner_id: h.hidden_at
            for h in HiddenConversation.objects.filter(user=user, partner_id__in=partner_ids)
        }

        contacts_map = {
            c.contact_id: c
            for c in ContactModels.objects.filter(
                user=user, contact_id__in=partner_ids
            ).select_related("contact", "contact__user_profile")
        }

        partners = User.objects.filter(id__in=partner_ids).select_related("user_profile")
        partners_map = {p.id: p for p in partners}

        # ✅ NEW: کسایی که خودِ من رو مخاطب خودشون کردن — برای چک «فقط مخاطبین»
        # توی حریم خصوصی (last_seen/photo/about visibility)
        who_has_me_as_contact = set(
            ContactModels.objects.filter(contact_id=user.id).values_list("user_id", flat=True)
        )

        def can_see(visibility, target_id):
            if visibility == "everyone":
                return True
            if visibility == "nobody":
                return False
            return target_id in who_has_me_as_contact

        results = []
        for pid in partner_ids:
            partner = partners_map.get(pid)
            if not partner:
                continue

            last_msg = (
                MessageModels.objects.filter(
                    Q(sender=user, receiver_id=pid) | Q(sender_id=pid, receiver=user)
                )
                .order_by("-created_date")
                .first()
            )
            if not last_msg:
                continue

            # اگه این چت مخفی شده و بعد از مخفی‌شدن پیام جدیدی رد و بدل نشده، نشونش نده
            hidden_at = hidden_map.get(pid)
            if hidden_at is not None and last_msg.created_date <= hidden_at:
                continue

            contact = contacts_map.get(pid)
            profile = getattr(partner, "user_profile", None)

            if contact and contact.display_name:
                name = contact.display_name
            elif profile and (profile.first_name or profile.last_name):
                name = profile.get_fullname()
            else:
                name = partner.email or partner.phone_number

            try:
                partner_settings = partner.settings
            except UserSettings.DoesNotExist:
                partner_settings = None

            # ✅ FIX: عکس قبلاً بی‌قید و شرط فرستاده می‌شد، الان photo_visibility رو چک می‌کنه
            image = None
            if profile and profile.image:
                photo_visibility = partner_settings.photo_visibility if partner_settings else "everyone"
                if can_see(photo_visibility, pid):
                    image = request.build_absolute_uri(profile.image.url)

            # ✅ NEW: بیوگرافی — قبلاً اصلاً توی این پاسخ نبود
            bio = None
            if profile:
                about_visibility = partner_settings.about_visibility if partner_settings else "everyone"
                if can_see(about_visibility, pid):
                    bio = profile.bio

            # ✅ NEW: آخرین بازدید — قبلاً اصلاً توی این پاسخ نبود
            last_seen = None
            if partner.last_seen:
                last_seen_visibility = partner_settings.last_seen_visibility if partner_settings else "everyone"
                if can_see(last_seen_visibility, pid):
                    last_seen = partner.last_seen.isoformat()

            results.append({
                "id": partner.id,
                "name": name,
                "email": partner.email,
                "phone_number": partner.phone_number,
                "profile": image,
                "bio": bio,
                "last_seen": last_seen,
                "is_contact": contact is not None,
                "contact_record_id": contact.id if contact else None,
                "last_message": MessageSerializer(last_msg, context={"request": request}).data,
            })

        results.sort(
            key=lambda r: r["last_message"]["created_date"],
            reverse=True,
        )
        return Response(results)
# ======================================================================================================================
class DeleteConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, partner_id):
        obj, created = HiddenConversation.objects.get_or_create(
            user=request.user, partner_id=partner_id
        )
        if not created:
            obj.save()  # hidden_at با auto_now آپدیت می‌شه

        return Response(status=status.HTTP_204_NO_CONTENT)
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