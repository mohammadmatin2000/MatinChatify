from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import UserSettings
from .serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    UserSettingsSerializer,
)
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


class ChangePasswordView(APIView):
    """POST /settings/change-password/  {old_password, new_password}"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "رمز عبور با موفقیت تغییر کرد."}, status=status.HTTP_200_OK)


class DeleteAccountView(APIView):


    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.delete()
        return Response({"detail": "حساب کاربری حذف شد."}, status=status.HTTP_200_OK)
# ======================================================================================================================