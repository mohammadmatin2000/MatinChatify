# -*- coding: utf-8 -*-

# برای اعتبارسنجی فرمت شماره تلفن با عبارت باقاعده (regex)
import re

# ابزار اصلی ساخت سریالایزر در Django REST Framework
from rest_framework import serializers

# گرفتن مدل کاربر فعال پروژه (به‌جای import مستقیم، تا اگه مدل کاربر عوض شد کد بشکنه)
from django.contrib.auth import get_user_model

# اعتبارسنج داخلی جنگو برای رمز عبور (طول، پیچیدگی، رمز رایج نبودن و ...)
from django.contrib.auth.password_validation import validate_password

# تبدیل امن بایت‌ها به رشته (برای کدگشایی uid)
from django.utils.encoding import smart_str

# رمزگشایی مقدار base64 که در لینک‌های فعال‌سازی/ریست رمز استفاده می‌شه
from django.utils.http import urlsafe_base64_decode

# تولیدکننده و اعتبارسنج توکن‌های امن (برای لینک فعال‌سازی/ریست رمز)
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.tokens import default_token_generator

# سریالایزر پایه‌ی JWT که برای اضافه کردن اطلاعات دلخواه به توکن ازش ارث‌بری می‌کنیم
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# مدل‌های داخلی اپ اکانت
from accounts.models import Profile, PhoneOTP

User = get_user_model()


# ======================================================================================================================
# سریالایزر ثبت‌نام کاربر جدید با ایمیل و رمز عبور
# ======================================================================================================================
class RegisterSerializer(serializers.ModelSerializer):
    # رمز عبور فقط برای نوشتن (هیچ‌وقت در پاسخ API برگردونده نمی‌شه)
    # validate_password از اعتبارسنج‌های امنیتی خود جنگو استفاده می‌کنه
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    # فیلد تکرار رمز عبور برای اطمینان از عدم اشتباه تایپی کاربر
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("id", "email", "password", "confirm_password")

    # بررسی یکسان بودن رمز عبور و تکرار آن
    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "رمزهای عبور مطابقت ندارند"}
            )
        return attrs

    # ساخت کاربر جدید بعد از عبور موفق از اعتبارسنجی
    def create(self, validated_data):
        # این فیلد فقط برای اعتبارسنجی بود، نیازی به ذخیره‌اش نیست
        validated_data.pop("confirm_password", None)

        user = User.objects.create_user(
            email=validated_data["email"], password=validated_data["password"]
        )
        # کاربر تا وقتی لینک فعال‌سازی ایمیلش رو نزنه، تاییدشده محسوب نمی‌شه
        user.is_verified = False
        user.save()
        return user


# ======================================================================================================================
# سریالایزر دریافت ایمیل برای شروع فرآیند «فراموشی رمز عبور»
# ======================================================================================================================
class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

    # بررسی این‌که ایمیل واردشده متعلق به یک کاربر واقعی در سیستم باشه
    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("کاربری با این ایمیل وجود ندارد.")
        return value


# ======================================================================================================================
# سریالایزر ثبت رمز عبور جدید بعد از تایید لینک ریست رمز
# ======================================================================================================================
class SetNewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=True)

    # نکته: این سریالایزر برای کار درست به uidb64 و token هم نیاز داره که باید
    # از بیرون (مثلاً از URL) به attrs اضافه بشن، وگرنه این‌جا KeyError می‌ده
    def validate(self, attrs):
        try:
            uid = urlsafe_base64_decode(attrs["uidb64"]).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("لینک فعال‌سازی نامعتبر است.")

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError("توکن منقضی شده یا نامعتبر است.")

        attrs["user"] = user
        return attrs

    # ذخیره‌ی رمز عبور جدید برای کاربر معتبرشناسی‌شده
    def save(self):
        password = self.validated_data["password"]
        user = self.validated_data["user"]
        user.set_password(password)
        user.save()
        return user


# ======================================================================================================================
# سریالایزر فعال‌سازی حساب کاربری از طریق لینک ایمیل (uidb64 + token)
# ======================================================================================================================
class ActivationSerializer(serializers.Serializer):
    token = serializers.CharField()
    uidb64 = serializers.CharField()

    # رمزگشایی uid، پیدا کردن کاربر و بررسی معتبر بودن توکن فعال‌سازی
    def validate(self, attrs):
        token = attrs.get("token")
        uidb64 = attrs.get("uidb64")
        try:
            id = smart_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=id)
            if not PasswordResetTokenGenerator().check_token(user, token):
                raise serializers.ValidationError("لینک فعال‌سازی نامعتبر است.")
            attrs["user"] = user
            return attrs
        except Exception:
            # هر خطای غیرمنتظره‌ای (uid نامعتبر، کاربر پیدا نشد و ...) رو
            # با یک پیام یکسان و امن به کاربر برمی‌گردونیم
            raise serializers.ValidationError("خطا در فعال‌سازی.")

    # فعال کردن حساب کاربری تاییدشده
    def save(self):
        user = self.validated_data["user"]
        user.is_active = True
        user.save()
        return user


# ======================================================================================================================
# سریالایزر سفارشی گرفتن توکن JWT (لاگین)
# اطلاعات بیشتری (ایمیل) رو هم به خود توکن و هم به پاسخ API اضافه می‌کنه
# ======================================================================================================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # اضافه کردن ایمیل کاربر به payload توکن (قابل خوندن بدون نیاز به کوئری دیتابیس)
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # علاوه بر access/refresh token، اطلاعات پایه‌ی کاربر رو هم مستقیم به پاسخ اضافه می‌کنیم
        # تا فرانت مجبور نباشه یک درخواست جدا برای گرفتن اطلاعات کاربر بزنه
        data.update(
            {
                "id": self.user.id,
                "email": self.user.email,
            }
        )
        return data


# ======================================================================================================================
# سریالایزر مشاهده و ویرایش پروفایل کاربر
# ======================================================================================================================
class UserProfileUpdateSerializer(serializers.ModelSerializer):
    # این دو فیلد از روی مدل User (نه Profile) خونده می‌شن، پس فقط-خواندنی هستن
    id = serializers.IntegerField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "image",
            "bio",
        ]


# ======================================================================================================================
# سریالایزر درخواست کد OTP پیامکی (اعتبارسنجی فرمت شماره موبایل ایرانی)
# ======================================================================================================================
class RequestOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()

    # شماره باید با الگوی موبایل ایران (۰۹ به همراه ۹ رقم بعدی) مطابقت داشته باشه
    def validate_phone_number(self, value):
        if not re.match(r"^09\d{9}$", value):
            raise serializers.ValidationError("شماره موبایل معتبر نیست.")
        return value


# ======================================================================================================================
# سریالایزر بررسی و تایید کد OTP پیامکی ارسال‌شده
# ======================================================================================================================
class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone_number = attrs["phone_number"]
        code = attrs["code"]

        # آخرین کد مصرف‌نشده‌ی مربوط به این شماره رو پیدا می‌کنیم
        otp = (
            PhoneOTP.objects.filter(phone_number=phone_number, is_used=False)
            .order_by("-created_date")
            .first()
        )
        if not otp:
            raise serializers.ValidationError("کدی برای این شماره ارسال نشده.")
        if not otp.is_valid():
            raise serializers.ValidationError("کد منقضی شده یا تعداد تلاش‌ها زیاد بوده.")
        if otp.code != code:
            # کد اشتباه بود؛ شمارنده‌ی تلاش‌های ناموفق رو یکی زیاد می‌کنیم
            # (برای جلوگیری از حمله‌ی حدس‌زدن پشت‌سرهم)
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            raise serializers.ValidationError("کد وارد شده اشتباه است.")

        # کد درست بود؛ به‌عنوان مصرف‌شده علامت می‌زنیم تا دوباره قابل استفاده نباشه
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        attrs["otp"] = otp
        return attrs
# ======================================================================================================================