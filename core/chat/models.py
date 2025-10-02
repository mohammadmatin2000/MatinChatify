from django.db import models
from accounts.models import User
# ======================================================================================================================
class ContactModels(models.Model):
    # فیلدی برای نگهداری کاربری که کانتکت را اضافه کرده است
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacts")

    # فیلدی برای نگهداری کاربری که به عنوان کانتکت ذخیره شده است
    contact = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacted_by")

    # فیلدی برای ذخیره تاریخ و زمان ارسال پیام
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش اطلاعات در قالب رشته (برای چاپ یا نمایش داده‌ها)
    def __str__(self):
        return f"{self.user.username} - {self.contact.username}"

# ======================================================================================================================
class ChatModels(models.Model):
    # فیلدی برای ذخیره شرکت‌کنندگان در چت، که می‌تواند بیش از یک کاربر باشد
    participants = models.ManyToManyField(User, related_name="chats")

    # فیلدی برای ذخیره پیام آخر چت که به صورت خارجی به مدل Message اشاره می‌کند
    last_message = models.ForeignKey("MessageModels", on_delete=models.SET_NULL, null=True, blank=True)

    # فیلدی برای ذخیره تاریخ و زمان ارسال پیام
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش اطلاعات در قالب رشته (برای چاپ یا نمایش داده‌ها)
    def __str__(self):
        return f"Chat between {', '.join([user.email for user in self.participants.all()])}"

# ======================================================================================================================
class MessageModels(models.Model):
    # فیلدی برای نگهداری ارسال‌کننده پیام، که به کاربر (User) اشاره دارد
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")

    # فیلدی برای نگهداری گیرنده پیام، که به کاربر (User) اشاره دارد
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")

    # فیلدی برای نگهداری متن پیام (اختیاری)
    text = models.TextField(null=True, blank=True)

    # فیلدی برای نگهداری تصویر پیام (اختیاری)
    image = models.ImageField(upload_to="messages/", null=True, blank=True)

    # فیلدی برای ذخیره تاریخ و زمان ارسال پیام
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    # نمایش اطلاعات در قالب رشته (برای چاپ یا نمایش داده‌ها)
    def __str__(self):
        return f"MessageModels from {self.sender.email} to {self.receiver.email} on {self.created_date}"
# ======================================================================================================================
