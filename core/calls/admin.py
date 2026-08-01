from django.contrib import admin
from .models import CallLogModel, GroupCallLogModel, GroupCallParticipantModel
# ======================================================================================================================
# نمایش شرکت‌کنندگان تماس گروهی به‌صورت اینلاین (داخل صفحه‌ی خود تماس)
class GroupCallParticipantInline(admin.TabularInline):
    model = GroupCallParticipantModel
    extra = 0
    readonly_fields = ("user", "joined_at", "left_at")
    can_delete = False
# ======================================================================================================================
# مدیریت تماس‌های خصوصی در پنل ادمین
@admin.register(CallLogModel)
class CallLogAdmin(admin.ModelAdmin):
    list_display = ("caller", "receiver", "call_type", "status", "duration", "started_at")
    list_filter = ("call_type", "status", "started_at")
    search_fields = ("caller__email", "receiver__email")
    readonly_fields = ("started_at",)
# ======================================================================================================================
# مدیریت تماس‌های گروهی در پنل ادمین
@admin.register(GroupCallLogModel)
class GroupCallLogAdmin(admin.ModelAdmin):
    list_display = ("group", "initiator", "call_type", "status", "duration", "started_at")
    list_filter = ("call_type", "status", "started_at")
    search_fields = ("group__name", "initiator__email")
    readonly_fields = ("started_at",)
    inlines = [GroupCallParticipantInline]
# ======================================================================================================================