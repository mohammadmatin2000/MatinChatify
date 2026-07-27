from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import ContactModels, ChatModels, MessageModels
from .serializers import ContactSerializer, ChatSerializer, MessageSerializer
from accounts.models import User
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers
# ======================================================================================================================
class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ContactModels.objects.filter(
            user=self.request.user
        ).select_related("contact", "contact__user_profile")

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        contact_user = serializer.validated_data.get("contact")

        if contact_user == self.request.user:
            raise drf_serializers.ValidationError(
                {"contact": "نمی‌توانید خودتان را به مخاطبین اضافه کنید."}
            )

        if ContactModels.objects.filter(user=self.request.user, contact=contact_user).exists():
            raise drf_serializers.ValidationError(
                {"contact": "این کاربر قبلاً در لیست مخاطبین شماست."}
            )

        serializer.save(user=self.request.user)
# ======================================================================================================================
class SearchUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response([])

        users = User.objects.filter(
            Q(email__icontains=query)
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
                "name": name or u.email,
                "profile": image,
                "is_contact": u.id in my_contact_ids,
            })
        return Response(result)
# ======================================================================================================================
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
        serializer.save(sender=sender, receiver=receiver)
# ======================================================================================================================