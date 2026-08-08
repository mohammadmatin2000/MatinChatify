from django.contrib import admin
from .models import ContactModels, ChatModels, MessageModels, BlockModels, ReportModels
# ======================================================================================================================
class ContactAdmin(admin.ModelAdmin):
    list_display = ('user', 'contact', 'display_name')
    list_filter = ('user', 'contact')
    search_fields = ('user__email', 'contact__email', 'contact__phone_number', 'display_name')
    fields = ('user', 'contact', 'display_name')


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
    list_display = ('sender', 'receiver', 'message_type', 'text', 'created_date', 'image', 'is_read', 'read_at')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('sender', 'receiver', 'message_type', 'created_date', 'is_read')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('sender__email', 'receiver__email', 'text')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('sender', 'receiver', 'message_type', 'text', 'image', 'file', 'file_name', 'meta', 'is_read', 'read_at')

    # این دوتا فقط سیستمی ست می‌شن، نباید دستی از ادمین تغییر کنن
    readonly_fields = ('read_at',)


# ثبت مدل Message در پنل ادمین
admin.site.register(MessageModels, MessageAdmin)

# ======================================================================================================================
# ✅ NEW: مدیریت کاربران بلاک‌شده در پنل ادمین
class BlockAdmin(admin.ModelAdmin):

    # نمایش فیلدهای موردنظر در لیست
    list_display = ('user', 'blocked_user', 'created_date')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('created_date',)

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('user__email', 'blocked_user__email', 'user__phone_number', 'blocked_user__phone_number')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('user', 'blocked_user')


# ثبت مدل Block در پنل ادمین
admin.site.register(BlockModels, BlockAdmin)

# ======================================================================================================================
# ✅ NEW: مدیریت گزارش‌های کاربران در پنل ادمین
class ReportAdmin(admin.ModelAdmin):

    # نمایش فیلدهای موردنظر در لیست
    list_display = ('reporter', 'reported_user', 'reason', 'created_date')

    # فیلتر بر اساس فیلدهای مختلف
    list_filter = ('reason', 'created_date')

    # جستجو بر اساس فیلدهای مختلف
    search_fields = ('reporter__email', 'reported_user__email', 'description')

    # تنظیمات فیلدهای نمایش داده‌شده در فرم اضافه/ویرایش
    fields = ('reporter', 'reported_user', 'reason', 'description')

    # گزارش‌ها فقط باید از طریق کاربر ثبت بشن، نه دستی از ادمین
    def has_add_permission(self, request):
        return False


# ثبت مدل Report در پنل ادمین
admin.site.register(ReportModels, ReportAdmin)
# ======================================================================================================================