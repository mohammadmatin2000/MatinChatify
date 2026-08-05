from django.db import models
from accounts.models import User
import uuid
# ======================================================================================================================
class ChannelModels(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="channels/", blank=True, null=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_channels")

    # عمومی = هرکی لینک/کد دعوت داره جوین شه، خصوصی = فقط ادمین مستقیم اضافه می‌کنه
    is_public = models.BooleanField(default=True)

    # کد دعوت یکتا (برای کانال‌های عمومی، مبنای لینک join)
    invite_code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
# ======================================================================================================================
class ChannelMember(models.Model):
    ROLE_CHOICES = (
        ("admin", "ادمین"),        # می‌تونه پیام بده، پست کنه، عضو اضافه/حذف کنه
        ("subscriber", "مشترک"),   # فقط می‌خونه
    )
    channel = models.ForeignKey(ChannelModels, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="channel_memberships")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="subscriber")
    joined_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("channel", "user")

    def __str__(self):
        return f"{self.user} in {self.channel} ({self.role})"
# ======================================================================================================================
class ChannelMessage(models.Model):
    # ✅ FIX: انواع پیام رو با ChatConsumer/GroupCallLog و بقیه‌ی اپ هماهنگ کردیم —
    # قبلاً فقط text/image/file بود، برای همین voice/video_note/location/contact/poll
    # (که همه از این choices استفاده می‌کردن) عملاً پشتیبانی نمی‌شدن
    MESSAGE_TYPE_CHOICES = (
        ("text", "متن"),
        ("image", "عکس"),
        ("file", "فایل"),
        ("voice", "پیام صوتی"),
        ("video_note", "پیام ویدیویی"),
        ("location", "لوکیشن"),
        ("contact", "مخاطب"),
        ("poll", "نظرسنجی"),
    )
    channel = models.ForeignKey(ChannelModels, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="channel_messages")
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default="text")
    text = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="channel_messages/", blank=True, null=True)
    file = models.FileField(upload_to="channel_files/", blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)
    # ✅ NEW: برای پیام‌های لوکیشن (lat/lng)، مخاطب (name/email/image)، و نظرسنجی (question/options)
    meta = models.JSONField(null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_date"]

    def __str__(self):
        return f"{self.channel} - {self.sender}"
# ======================================================================================================================