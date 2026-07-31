from django.contrib import admin
from .models import ContactModels, ChatModels, MessageModels
# ======================================================================================================================
# مدیریت مخاطبین در پنل ادمین
class ContactAdmin(admin.ModelAdmin):

    # نمایش فیلدهای موردنظر در لیست
    list_display = ('user', 'contact')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('user', 'contact')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('user__email', 'contact__email')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('user', 'contact')


# ثبت مدل Contact در پنل ادمین
admin.site.register(ContactModels, ContactAdmin)

# ======================================================================================================================
# مدیریت چت‌ها در پنل ادمین
class ChatAdmin(admin.ModelAdmin):

    # نمایش فیلدهای موردنظر در لیست
    list_display = ('id', 'get_participants',)

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('participants',)

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('id',)

    # متد برای نمایش نام کاربران شرکت‌کننده در چت
    def get_participants(self, obj):
        return ", ".join([user.email for user in obj.participants.all()])

    get_participants.short_description = 'Participants'

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('participants',)


# ثبت مدل Chat در پنل ادمین
admin.site.register(ChatModels, ChatAdmin)

# ======================================================================================================================
# مدیریت پیام‌ها در پنل ادمین
class MessageAdmin(admin.ModelAdmin):

    # نمایش فیلدهای موردنظر در لیست
    list_display = ('sender', 'receiver', 'message_type', 'text', 'created_date', 'image')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('sender', 'receiver', 'message_type', 'created_date')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('sender__email', 'receiver__email', 'text')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('sender', 'receiver', 'message_type', 'text', 'image', 'file', 'file_name', 'meta')


# ثبت مدل Message در پنل ادمین
admin.site.register(MessageModels, MessageAdmin)
# ======================================================================================================================