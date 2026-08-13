from django.dispatch import receiver
from django.db.models.signals import post_save
from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from django.db import models
import random
# ======================================================================================================================
class UserType(models.IntegerChoices):
    customer = 1, _("customer")
    admin = 2, _("admin")
    superuser = 3, _("superuser")
# ======================================================================================================================
class UserManager(BaseUserManager):

    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("The Email must be set"))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, **extra_fields):

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("type", UserType.superuser.value)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))
        return self.create_user(email, password, **extra_fields)

    def create_user_with_phone(self, phone_number, **extra_fields):
        if not phone_number:
            raise ValueError(_("The phone number must be set"))
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_unusable_password()
        user.save()
        return user
# ======================================================================================================================
class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(_("email address"), unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    is_staff = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    type = models.IntegerField(
        choices=UserType.choices, default=UserType.customer.value
    )
    last_seen = models.DateTimeField(null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email or self.phone_number or f"user-{self.pk}"
# ======================================================================================================================
class Profile(models.Model):
    user = models.OneToOneField(
        "User", on_delete=models.CASCADE, related_name="user_profile"
    )
    first_name = models.CharField(max_length=255,blank=True, null=True)
    last_name = models.CharField(max_length=255,blank=True, null=True)
    bio = models.CharField(max_length=140, blank=True, null=True, default="در دسترس")
    image = models.ImageField(
        upload_to="profile/", default="profile/default.png", blank=True, null=True
    )
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def get_fullname(self):
        first = self.first_name or ""
        last = self.last_name or ""

        fullname = f"{first} {last}".strip()

        return fullname if fullname else "کاربر جدید"
# ======================================================================================================================
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, pk=instance.pk)
# ======================================================================================================================
class PhoneOTP(models.Model):
    phone_number = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    created_date = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["phone_number", "is_used"])]

    def __str__(self):
        return f"OTP({self.phone_number})"

    @staticmethod
    def generate_code():
        return f"{random.randint(0, 999999):06d}"

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5
# ======================================================================================================================
class TwoFactorCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="two_factor_codes")
    code = models.CharField(max_length=6)
    created_date = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    @staticmethod
    def generate_code():
        return f"{random.randint(0, 999999):06d}"

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5
# ======================================================================================================================