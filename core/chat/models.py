from django.db import models
from accounts.models import User, Profile
# ======================================================================================================================
# مدل مخاطبین (رابطه‌ی بین یک کاربر و کسی که به لیست مخاطبینش اضافه کرده)
class ContactModels(models.Model):

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="contacts"
    )
    profile = models.ForeignKey(
        Profile, on_delete=models.CASCADE, related_name="contacts",
        null=True, blank=True
    )
    contact = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="contacted_by"
    )

    # اسمی که خودِ کاربر برای این مخاطب انتخاب کرده (مثل واتساب)
    display_name = models.CharField(max_length=255, blank=True, null=True)

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "contact")

    def __str__(self):
        return f"{self.user} - {self.contact}"
# ======================================================================================================================
# مدل چت (گفتگوی خصوصی بین دو یا چند کاربر)
class ChatModels(models.Model):

    # کاربران شرکت‌کننده در این چت
    participants = models.ManyToManyField(
        User,
        related_name="chats"
    )

    # تاریخ ایجاد چت
    created_date = models.DateTimeField(auto_now_add=True)

    # تاریخ آخرین بروزرسانی چت
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش لیست ایمیل شرکت‌کنندگان چت
    def __str__(self):
        return f"Chat between {', '.join([u.email for u in self.participants.all()])}"
# ======================================================================================================================
# مدل پیام‌های خصوصی بین دو کاربر
class MessageModels(models.Model):

    MESSAGE_TYPES = (
        ("text", "Text"),
        ("image", "Image"),
        ("file", "File"),
        ("location", "Location"),
        ("contact", "Contact"),
        ("voice", "Voice"),
        ("video_note", "Video note"),
    )

    # فرستنده‌ی پیام
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_messages"
    )

    # گیرنده‌ی پیام
    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_messages"
    )

    # نوع پیام (متن، عکس، فایل، لوکیشن، مخاطب)
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPES,
        default="text"
    )

    # متن پیام (برای پیام متنی، یا کپشن روی عکس/فایل)
    text = models.TextField(null=True, blank=True)

    # تصویر پیام (وقتی message_type برابر "image" باشه)
    image = models.ImageField(
        upload_to="messages/",
        null=True,
        blank=True
    )

    # فایل پیوست‌شده / داکیومنت (وقتی message_type برابر "file" باشه)
    file = models.FileField(
        upload_to="message_files/",
        null=True,
        blank=True
    )

    # نام اصلی فایل آپلودشده (برای نمایش به کاربر، چون اسم فایل روی سرور تغییر می‌کنه)
    file_name = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    # داده‌ی اضافی JSON برای پیام‌های خاص (مثل مختصات لوکیشن یا اطلاعات مخاطب ارسالی)
    meta = models.JSONField(null=True, blank=True)

    # تاریخ ارسال پیام
    created_date = models.DateTimeField(auto_now_add=True)

    # تاریخ آخرین بروزرسانی پیام (مثلاً هنگام ویرایش)
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش پیام (فرستنده → گیرنده)
    def __str__(self):
        return f"{self.sender.email} → {self.receiver.email}"
# ======================================================================================================================