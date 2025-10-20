from django.contrib import admin
from .models import ContactModels, ChatModels, MessageModels
# ======================================================================================================================
class ContactAdmin(admin.ModelAdmin):
    # نمایش فیلدهای موردنظر در لیست
    list_display = ('user', 'contact')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('user', 'contact')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('user__username', 'contact__username')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('user', 'contact')


# ثبت مدل Contact در پنل ادمین
admin.site.register(ContactModels, ContactAdmin)

# ======================================================================================================================
class ChatAdmin(admin.ModelAdmin):
    # نمایش فیلدهای موردنظر در لیست
    list_display = ('id', 'get_participants', 'last_message')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('participants', 'last_message')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('id',)

    # متد برای نمایش نام کاربران شرکت‌کننده در چت
    def get_participants(self, obj):
        return ", ".join([user.email for user in obj.participants.all()])

    get_participants.short_description = 'Participants'

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('participants', 'last_message')


# ثبت مدل Chat در پنل ادمین
admin.site.register(ChatModels, ChatAdmin)

# ======================================================================================================================
class MessageAdmin(admin.ModelAdmin):
    # نمایش فیلدهای موردنظر در لیست
    list_display = ('sender', 'receiver', 'text', 'created_date', 'image','chat')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('sender', 'receiver', 'created_date')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('sender__username', 'receiver__username', 'text')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('sender', 'receiver', 'text', 'image')


# ثبت مدل Message در پنل ادمین
admin.site.register(MessageModels, MessageAdmin)
# ======================================================================================================================
