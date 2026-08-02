from django.db import models
from accounts.models import User, Profile
# ======================================================================================================================
# مدل گروه‌های چت (مثل گروه‌های واتساپ/تلگرام)
class Group(models.Model):

    # نام گروه
    name = models.CharField(max_length=255)

    # مالک/سازنده‌ی گروه
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="owned_groups"
    )

    # توضیحات گروه (اختیاری)
    description = models.TextField(blank=True, default="")

    # تصویر آواتار گروه
    avatar = models.ImageField(
        upload_to="group_avatars/",
        null=True,
        blank=True
    )

    # آیا گروه فعاله؟ (برای غیرفعال/آرشیو کردن بدون حذف کامل)
    is_active = models.BooleanField(default=True)

    # تاریخ ایجاد گروه
    created_date = models.DateTimeField(auto_now_add=True)

    # تاریخ آخرین بروزرسانی گروه
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش نام گروه
    def __str__(self):
        return self.name
# ======================================================================================================================
# مدل عضویت کاربران در گروه (رابطه‌ی چند-به-چند بین User و Group، همراه با نقش)
class GroupMember(models.Model):

    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("member", "Member"),
    )

    # کاربر عضو
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_memberships"
    )

    # گروهی که کاربر عضوشه
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="members"
    )

    # نقش کاربر داخل گروه (ادمین یا عضو عادی)
    role = models.CharField(
        max_length=255,
        choices=ROLE_CHOICES,
        default="member"
    )

    # تاریخ پیوستن کاربر به گروه
    joined_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        # هر کاربر فقط یک‌بار می‌تونه عضو یک گروه خاص باشه
        unique_together = ("user", "group")

    # نمایش عضویت (ایمیل کاربر - نام گروه - نقش)
    def __str__(self):
        return f"{self.user.email} - {self.group.name} ({self.role})"
# ======================================================================================================================
# مدل پیام‌های داخل گروه (شبیه به مدل پیام خصوصی، ولی متصل به گروه به‌جای گیرنده‌ی مشخص)
class GroupMessages(models.Model):

    MESSAGE_TYPES = (
        ("text", "Text"),
        ("image", "Image"),
        ("file", "File"),
        ("location", "Location"),
        ("contact", "Contact"),
        ("voice", "Voice"),
        ("video_note", "Video note"),
    )

    # گروهی که این پیام توش ارسال شده
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="messages"
    )

    # نویسنده‌ی پیام
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_messages"
    )

    # نوع پیام (متن، عکس، فایل، لوکیشن، مخاطب)
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPES,
        default="text"
    )

    # متن پیام (برای پیام‌های متنی، یا کپشن روی عکس/فایل)
    text = models.TextField(blank=True, default="")

    # تصویر پیام (وقتی message_type برابر "image" باشه)
    image = models.ImageField(
        upload_to="group_messages/",
        null=True,
        blank=True
    )

    # فایل پیوست‌شده (وقتی message_type برابر "file" باشه)
    file = models.FileField(
        upload_to="group_message_files/",
        null=True,
        blank=True
    )

    # نام اصلی فایل آپلودشده (برای نمایش به کاربر، چون اسم فایل روی سرور تغییر می‌کنه)
    file_name = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    # داده‌ی اضافی JSON برای پیام‌های خاص (مثل مختصات لوکیشن یا اطلاعات مخاطب)
    meta = models.JSONField(null=True, blank=True)

    # آیا این پیام ویرایش شده؟
    is_edited = models.BooleanField(default=False)

    # آیا این پیام حذف شده؟ (soft delete - رکورد پاک نمیشه، فقط پرچم می‌خوره)
    is_deleted = models.BooleanField(default=False)

    # تاریخ ارسال پیام
    created_date = models.DateTimeField(auto_now_add=True)

    # تاریخ آخرین ویرایش پیام
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش خلاصه‌ی پیام (نویسنده، گروه، ۳۰ کاراکتر اول متن)
    def __str__(self):
        return f"{self.author.email} در {self.group.name}: {self.text[:30]}"
# ======================================================================================================================
# مدل پیوست‌های اضافی روی یک پیام گروهی (برای حالتی که یک پیام چند فایل ضمیمه داشته باشه)
class GroupAttachment(models.Model):

    # پیامی که این پیوست بهش تعلق داره
    message = models.ForeignKey(
        GroupMessages,
        on_delete=models.CASCADE,
        related_name="attachments"
    )

    # فایل پیوست‌شده
    file = models.FileField(upload_to="group_files/")

    # تاریخ آپلود پیوست
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # نمایش پیوست (شماره پیام + نام گروه)
    def __str__(self):
        return f"Attachment for message {self.message.id} in {self.message.group.name}"
# ======================================================================================================================
# مدل لینک/کد دعوت برای عضویت در گروه
class GroupInvite(models.Model):

    # گروهی که این دعوت‌نامه برای اونه
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="invites"
    )

    # کد یکتای دعوت (برای ساخت لینک دعوت)
    code = models.CharField(max_length=10, unique=True)

    # کاربری که این دعوت‌نامه رو ساخته
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    # تاریخ ساخت دعوت‌نامه
    created_date = models.DateTimeField(auto_now_add=True)

    # تاریخ انقضای دعوت‌نامه (اختیاری - اگه خالی باشه یعنی همیشه معتبره)
    expires_date = models.DateTimeField(null=True, blank=True)

    # نمایش دعوت‌نامه (کد + نام گروه)
    def __str__(self):
        return f"Invite {self.code} for {self.group.name}"
# ======================================================================================================================