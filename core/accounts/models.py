# -*- coding: utf-8 -*-

# سیگنال‌ها: برای اجرای یک تابع بلافاصله بعد از ذخیره شدن یک مدل (مثلاً ساخت خودکار پروفایل بعد از ساخت کاربر)
from django.dispatch import receiver
from django.db.models.signals import post_save

# کلاس پایه برای ساخت مدیر سفارشی مدل کاربر (UserManager)
from django.contrib.auth.base_user import BaseUserManager

# برای ترجمه‌پذیر کردن متن‌های ثابت (فعلاً فقط انگلیسی تعریف شدن، ولی قابلیت ترجمه دارن)
from django.utils.translation import gettext_lazy as _

# کلاس‌های پایه‌ی جنگو برای ساخت مدل کاربر سفارشی (به‌جای مدل پیش‌فرض User جنگو)
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

# برای گرفتن زمان فعلی با در نظر گرفتن تایم‌زون پروژه
from django.utils import timezone

# ابزارهای اصلی ساخت مدل در جنگو (فیلدها و ...)
from django.db import models

# برای تولید کد تصادفی OTP
import random


# ======================================================================================================================
# نوع/نقش کاربر در سیستم (مشتری، ادمین، سوپریوزر)
# از IntegerChoices استفاده شده تا در دیتابیس به‌صورت عدد ذخیره بشه (بهینه‌تر از رشته)
# ======================================================================================================================
class UserType(models.IntegerChoices):
    customer = 1, _("customer")      # کاربر عادی/مشتری
    admin = 2, _("admin")            # ادمین
    superuser = 3, _("superuser")    # مدیر کل سیستم


# ======================================================================================================================
# مدیر سفارشی مدل User
# چون مدل User ما از AbstractBaseUser ارث‌بری کرده (نه مدل پیش‌فرض جنگو)،
# باید خودمون منطق ساخت کاربر عادی و سوپریوزر رو پیاده‌سازی کنیم
# ======================================================================================================================
class UserManager(BaseUserManager):

    # ساخت یک کاربر عادی بر اساس ایمیل و رمز عبور
    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("The Email must be set"))

        # نرمال‌سازی ایمیل (مثلاً یکسان‌سازی حروف بزرگ/کوچک بخش دامنه)
        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # هش کردن رمز عبور قبل از ذخیره
        user.save()
        return user

    # ساخت کاربر سوپریوزر (برای دستور createsuperuser جنگو)
    def create_superuser(self, email, password, **extra_fields):
        # مقادیر پیش‌فرض لازم برای سوپریوزر رو تنظیم می‌کنیم
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("type", UserType.superuser.value)

        # اطمینان از این‌که کسی به‌اشتباه این مقادیر رو False پاس نداده
        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self.create_user(email, password, **extra_fields)

    # ساخت کاربر فقط با شماره تلفن (بدون رمز عبور مشخص - برای ورود با OTP)
    def create_user_with_phone(self, phone_number, **extra_fields):
        if not phone_number:
            raise ValueError(_("The phone number must be set"))

        user = self.model(phone_number=phone_number, **extra_fields)
        # چون کاربر با OTP وارد می‌شه، رمز عبور قابل استفاده‌ای نداره
        user.set_unusable_password()
        user.save()
        return user


# ======================================================================================================================
# مدل اصلی کاربر پروژه
# به‌جای مدل پیش‌فرض جنگو، از AbstractBaseUser استفاده شده تا بشه هم با ایمیل
# و هم با شماره تلفن کاربر رو مدیریت کرد
# ======================================================================================================================
class User(AbstractBaseUser, PermissionsMixin):
    # ایمیل کاربر - یکتا، ولی اختیاریه (چون ممکنه کاربر فقط با شماره ثبت‌نام کرده باشه)
    email = models.EmailField(_("email address"), unique=True, null=True, blank=True)

    # شماره تلفن کاربر - یکتا، ولی اختیاریه (چون ممکنه کاربر فقط با ایمیل ثبت‌نام کرده باشه)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)

    # دسترسی به پنل ادمین جنگو
    is_staff = models.BooleanField(default=True)

    # فعال بودن اکانت (غیرفعال = مسدود/حذف نرم)
    is_active = models.BooleanField(default=True)

    # آیا کاربر احراز هویت شده (ایمیل/شماره تاییدشده) یا نه
    is_verified = models.BooleanField(default=False)

    # نقش کاربر در سیستم (مشتری/ادمین/سوپریوزر)
    type = models.IntegerField(
        choices=UserType.choices, default=UserType.customer.value
    )

    # آخرین زمان آنلاین/فعالیت کاربر
    last_seen = models.DateTimeField(null=True, blank=True)

    # زمان ساخته شدن اکانت (فقط یک‌بار موقع ساخت ثبت می‌شه)
    created_date = models.DateTimeField(auto_now_add=True)

    # زمان آخرین به‌روزرسانی رکورد کاربر (هر بار ذخیره خودکار آپدیت می‌شه)
    updated_date = models.DateTimeField(auto_now=True)

    # فیلدی که برای لاگین به‌عنوان "نام کاربری" استفاده می‌شه
    USERNAME_FIELD = "email"

    # فیلدهای اجباری اضافه هنگام ساخت کاربر از طریق createsuperuser (فعلاً هیچی)
    REQUIRED_FIELDS = []

    # اتصال مدیر سفارشی که بالاتر تعریف شد
    objects = UserManager()

    # نمایش خوانا از کاربر (مثلاً توی پنل ادمین یا لاگ‌ها)
    def __str__(self):
        return self.email or self.phone_number or f"user-{self.pk}"


# ======================================================================================================================
# مدل پروفایل کاربر
# اطلاعات نمایشی/غیرحساس کاربر (نام، بیو، عکس) که جدا از مدل User نگه‌داری می‌شه
# ======================================================================================================================
class Profile(models.Model):
    # رابطه‌ی یک‌به‌یک با کاربر - با حذف کاربر، پروفایلش هم حذف می‌شه
    user = models.OneToOneField(
        "User", on_delete=models.CASCADE, related_name="user_profile"
    )

    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255, blank=True, null=True)

    # بیوگرافی کوتاه کاربر - مقدار پیش‌فرض فارسی
    bio = models.CharField(max_length=140, blank=True, null=True, default="در دسترس")

    # عکس پروفایل - در صورت نبود عکس، از تصویر پیش‌فرض استفاده می‌شه
    image = models.ImageField(
        upload_to="profile/", default="profile/default.png", blank=True, null=True
    )

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    # نام کامل کاربر رو برمی‌گردونه؛ اگه نام/نام‌خانوادگی ثبت نشده باشه یه مقدار پیش‌فرض میده
    def get_fullname(self):
        first = self.first_name or ""
        last = self.last_name or ""

        fullname = f"{first} {last}".strip()

        return fullname if fullname else "کاربر جدید"


# ======================================================================================================================
# سیگنال: به محض ساخته شدن یک کاربر جدید، به‌صورت خودکار یک پروفایل خالی براش ساخته می‌شه
# ======================================================================================================================
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    # فقط وقتی که رکورد User تازه ساخته شده (نه هر بار که ذخیره می‌شه) پروفایل بساز
    if created:
        Profile.objects.create(user=instance, pk=instance.pk)


# ======================================================================================================================
# مدل کد یک‌بارمصرف (OTP) پیامکی برای ورود/ثبت‌نام با شماره تلفن
# ======================================================================================================================
class PhoneOTP(models.Model):
    # ایندکس گذاشته شده چون همیشه بر اساس شماره تلفن جستجو می‌کنیم
    phone_number = models.CharField(max_length=20, db_index=True)

    code = models.CharField(max_length=6)
    created_date = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    # آیا این کد قبلاً مصرف شده (استفاده شده) یا نه
    is_used = models.BooleanField(default=False)

    # تعداد تلاش‌های ناموفق برای وارد کردن این کد (جلوگیری از حمله‌ی حدس‌زدن brute-force)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        # ایندکس ترکیبی برای سریع‌تر شدن کوئری‌های رایج (پیدا کردن آخرین کد فعال یک شماره)
        indexes = [models.Index(fields=["phone_number", "is_used"])]

    def __str__(self):
        return f"OTP({self.phone_number})"

    # تولید یک کد ۶ رقمی تصادفی (با صفرهای ابتدایی در صورت نیاز)
    @staticmethod
    def generate_code():
        return f"{random.randint(0, 999999):06d}"

    # آیا زمان انقضای این کد گذشته؟
    def is_expired(self):
        return timezone.now() >= self.expires_at

    # آیا این کد هنوز قابل استفاده‌ست؟ (مصرف نشده + منقضی نشده + کمتر از ۵ تلاش ناموفق)
    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5


# ======================================================================================================================
# مدل کد احراز هویت دومرحله‌ای (2FA) که از طریق ایمیل برای کاربر ارسال می‌شه
# ساختار و منطقش کاملاً مشابه PhoneOTP هست، با این تفاوت که به یک کاربر مشخص متصله
# ======================================================================================================================
class TwoFactorCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="two_factor_codes")

    code = models.CharField(max_length=6)
    created_date = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    # تولید یک کد ۶ رقمی تصادفی
    @staticmethod
    def generate_code():
        return f"{random.randint(0, 999999):06d}"

    # آیا زمان انقضای این کد گذشته؟
    def is_expired(self):
        return timezone.now() >= self.expires_at

    # آیا این کد هنوز قابل استفاده‌ست؟
    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5
# ======================================================================================================================