from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
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
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser,FormParser
from .models import PhoneOTP
from .sms import send_otp_sms
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings as django_settings
from .models import TwoFactorCode
from settings.models import UserSettings
from .serializers import (
    RegisterSerializer,
    EmailSerializer,
    SetNewPasswordSerializer,
    ActivationSerializer,
    CustomTokenObtainPairSerializer,
    UserProfileUpdateSerializer,
    RequestOTPSerializer,
    VerifyOTPSerializer
)
User = get_user_model()
# ======================================================================================================================
class RegisterViews(generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # ایجاد لینک فعالسازی
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        current_site = get_current_site(request).domain
        activation_link = f"http://{current_site}{reverse('activate-account')}?uidb64={uidb64}&token={token}"

        subject = "فعالسازی حساب کاربری"
        message = f"لطفا برای فعالسازی حساب خود روی لینک زیر کلیک کنید:\n{activation_link}"

        # جلوگیری از کرش کردن درخواست در صورت مشکل ایمیل
        try:
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
        except Exception as e:
            print("Email sending failed:", e)

        # ✅ بازگرداندن اطلاعات کاربر به فرانت
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "is_verified": user.is_verified,
                "detail": "ثبت‌نام با موفقیت انجام شد. لطفا ایمیل خود را برای فعالسازی چک کنید."
            },
            status=status.HTTP_201_CREATED
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
# ======================================================================================================================
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
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({"detail": "OK"}, status=status.HTTP_200_OK)  # تغییر وضعیت پاسخ به 200 OK

        except KeyError:
            return Response({"detail": "Refresh token is missing in the request body."},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Invalid token or error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
# ======================================================================================================================
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user

        user_settings, _ = UserSettings.objects.get_or_create(user=user)

        if user_settings.two_step_enabled:
            if not user.email:
                # کاربری که فقط با شماره ثبت‌نام کرده و ایمیل نداره، فعلاً
                # نمی‌تونیم کد بفرستیم؛ رد می‌شیم و مستقیم لاگینش می‌کنیم
                return Response(serializer.validated_data, status=status.HTTP_200_OK)

            code = TwoFactorCode.generate_code()
            TwoFactorCode.objects.create(
                user=user,
                code=code,
                expires_at=timezone.now() + timedelta(minutes=5),
            )
            try:
                send_mail(
                    subject="کد تایید دو مرحله‌ای چتیفای",
                    message=f"کد ورود شما: {code}\nاین کد تا ۵ دقیقه معتبره.",
                    from_email=django_settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                )
            except Exception as e:
                print("خطا در ارسال ایمیل کد دومرحله‌ای:", e)

            return Response(
                {"two_step_required": True, "user_id": user.id},
                status=status.HTTP_200_OK,
            )

        return Response(serializer.validated_data, status=status.HTTP_200_OK)
# ======================================================================================================================
class Verify2FAView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user_id = request.data.get("user_id")
        code = request.data.get("code")

        if not user_id or not code:
            return Response({"detail": "اطلاعات ناقص است."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "کاربر پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST)

        record = (
            TwoFactorCode.objects.filter(user=user, is_used=False)
            .order_by("-created_date")
            .first()
        )
        if not record:
            return Response({"detail": "کدی برای این کاربر ارسال نشده."}, status=status.HTTP_400_BAD_REQUEST)
        if not record.is_valid():
            return Response({"detail": "کد منقضی شده یا تعداد تلاش‌ها زیاد بوده."}, status=status.HTTP_400_BAD_REQUEST)
        if record.code != code:
            record.attempts += 1
            record.save(update_fields=["attempts"])
            return Response({"detail": "کد وارد شده اشتباه است."}, status=status.HTTP_400_BAD_REQUEST)

        record.is_used = True
        record.save(update_fields=["is_used"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "id": user.id,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )
# ======================================================================================================================
class UserProfileUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileUpdateSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user.user_profile
# ======================================================================================================================
class RequestPhoneOTPView(generics.GenericAPIView):
    serializer_class = RequestOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]

        recent = PhoneOTP.objects.filter(
            phone_number=phone_number, is_used=False
        ).order_by("-created_date").first()
        if recent and (timezone.now() - recent.created_date) < timedelta(seconds=60):
            return Response(
                {"detail": "کد قبلی هنوز معتبره، کمی صبر کن."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = PhoneOTP.generate_code()
        PhoneOTP.objects.create(
            phone_number=phone_number,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=2),
        )
        sent = send_otp_sms(phone_number, code)
        if not sent:
            return Response(
                {"detail": "ارسال پیامک ناموفق بود."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": "کد ارسال شد."}, status=status.HTTP_200_OK)
# ======================================================================================================================
class VerifyPhoneOTPView(generics.GenericAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]

        user, created = User.objects.get_or_create(
            phone_number=phone_number,
            defaults={"is_verified": True},
        )
        if created:
            user.set_unusable_password()
            user.save()
        elif not user.is_verified:
            user.is_verified = True
            user.save(update_fields=["is_verified"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "id": user.id,
                "phone_number": user.phone_number,
            },
            status=status.HTTP_200_OK,
        )
# ======================================================================================================================