from django.db import models
from accounts.models import User
from groups.models import Group
# ======================================================================================================================
# مدل تاریخچه‌ی تماس‌های خصوصی (یک‌به‌یک) صوتی/تصویری
class CallLogModel(models.Model):

    CALL_TYPES = (
        ("audio", "Audio"),
        ("video", "Video"),
    )

    STATUS_CHOICES = (
        ("answered", "Answered"),      # تماس برقرار شد
        ("missed", "Missed"),           # جواب داده نشد
        ("rejected", "Rejected"),       # رد شد
    )

    # کسی که تماس رو شروع کرده
    caller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="calls_made"
    )

    # کسی که بهش زنگ زده شده
    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="calls_received"
    )

    # نوع تماس (صوتی یا تصویری)
    call_type = models.CharField(max_length=10, choices=CALL_TYPES)

    # وضعیت نهایی تماس
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    # مدت زمان تماس به ثانیه (فقط وقتی answered باشه معنا داره)
    duration = models.PositiveIntegerField(default=0)

    # زمان شروع تماس
    started_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]

    # نمایش خلاصه‌ی تماس
    def __str__(self):
        return f"{self.caller.email} → {self.receiver.email} ({self.call_type}, {self.status})"
# ======================================================================================================================
# مدل تاریخچه‌ی تماس‌های گروهی صوتی/تصویری
class GroupCallLogModel(models.Model):

    CALL_TYPES = (
        ("audio", "Audio"),
        ("video", "Video"),
    )

    STATUS_CHOICES = (
        ("completed", "Completed"),     # تماس با موفقیت برگزار و تموم شد
        ("no_answer", "No Answer"),      # هیچ‌کس جواب نداد
    )

    # گروهی که این تماس توش برگزار شده
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="call_logs"
    )

    # کسی که تماس گروهی رو شروع کرده
    initiator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_calls_started"
    )

    # نوع تماس (صوتی یا تصویری)
    call_type = models.CharField(max_length=10, choices=CALL_TYPES)

    # وضعیت نهایی تماس
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="completed")

    # مدت زمان کل تماس به ثانیه (از شروع تا وقتی آخرین نفر خارج شد)
    duration = models.PositiveIntegerField(default=0)

    # زمان شروع تماس
    started_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]

    # نمایش خلاصه‌ی تماس گروهی
    def __str__(self):
        return f"{self.group.name} - تماس {self.call_type} توسط {self.initiator.email}"
# ======================================================================================================================
# مدل ثبت شرکت‌کنندگان هر تماس گروهی (کی، کِی وارد شد، کِی خارج شد)
class GroupCallParticipantModel(models.Model):

    # تماس گروهی مرتبط
    call = models.ForeignKey(
        GroupCallLogModel,
        on_delete=models.CASCADE,
        related_name="participants"
    )

    # کاربری که در این تماس شرکت کرده
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_call_participations"
    )

    # زمان ورود به تماس
    joined_at = models.DateTimeField(auto_now_add=True)

    # زمان خروج از تماس (خالی یعنی هنوز داخل تماسه)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("call", "user")

    # نمایش شرکت‌کننده
    def __str__(self):
        return f"{self.user.email} در تماس گروهی {self.call.id}"
# ======================================================================================================================