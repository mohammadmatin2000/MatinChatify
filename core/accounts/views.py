from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.urls import reverse
from django.contrib.sites.shortcuts import get_current_site
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.conf import settings
from django.utils.http import urlsafe_base64_decode
from rest_framework.views import APIView
from django.contrib.auth.hashers import make_password
from .serializers import (
    RegisterSerializer,
    EmailSerializer,
    SetNewPasswordSerializer,
    ActivationSerializer,
)

User = get_user_model()


# ======================================================================================================================
class RegisterViews(generics.GenericAPIView):
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        current_site = get_current_site(request).domain
        activation_link = f"http://{current_site}{reverse('activate-account')}?uidb64={uidb64}&token={token}"

        subject = "فعالسازی حساب کاربری"
        message = (
            f"لطفا برای فعالسازی حساب خود روی لینک زیر کلیک کنید:\n{activation_link}"
        )

        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

        return Response(
            {
                "detail": "ثبت‌نام با موفقیت انجام شد. لطفا ایمیل خود را برای فعالسازی چک کنید."
            }
        )


# ======================================================================================================================
class RequestPasswordResetEmail(generics.GenericAPIView):
    serializer_class = EmailSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.get(email=email)

        uidb64 = urlsafe_base64_encode(force_bytes(user.id))
        token = PasswordResetTokenGenerator().make_token(user)

        current_site = get_current_site(request).domain
        reset_link = f"http://{current_site}{reverse('password_reset_confirm', kwargs={'uidb64': uidb64, 'token': token})}"

        send_mail(
            subject="درخواست بازیابی رمز عبور",
            message=f"برای تغییر رمز عبور خود روی لینک زیر کلیک کنید:\n{reset_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"detail": "ایمیل بازیابی رمز ارسال شد."}, status=status.HTTP_200_OK
        )


# ====================================================================
class PasswordResetConfirmView(APIView):
    serializer_class = SetNewPasswordSerializer

    def post(self, request, uidb64, token, *args, **kwargs):
        password = request.data.get("password")
        if not password:
            return Response(
                {"error": "رمز جدید ارسال نشده است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "کاربر پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST
            )

        if default_token_generator.check_token(user, token):
            user.password = make_password(password)
            user.save()
            return Response({"detail": "رمز عبور با موفقیت تغییر کرد."})
        else:
            return Response(
                {"error": "لینک معتبر نیست یا منقضی شده."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ======================================================================================================================
class ActivateAccount(APIView):
    serializer_class = ActivationSerializer

    def get(self, request, *args, **kwargs):
        uidb64 = request.GET.get("uidb64")
        token = request.GET.get("token")
        if not uidb64 or not token:
            return Response(
                {"error": "پارامترهای لازم ارسال نشده‌اند"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.is_verified = True
            user.save()
            return Response({"detail": "حساب کاربری شما با موفقیت فعال شد."})
        else:
            return Response(
                {"error": "لینک فعال‌سازی نامعتبر است یا منقضی شده."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ======================================================================================================================