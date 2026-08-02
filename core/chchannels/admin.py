from django.contrib import admin
from .models import ChannelModels, ChannelMember, ChannelMessage
# ======================================================================================================================
class ChannelMemberInline(admin.TabularInline):
    model = ChannelMember
    extra = 0
# ======================================================================================================================
class ChannelAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "is_public", "created_date")
    list_filter = ("is_public",)
    search_fields = ("name", "owner__email", "owner__phone_number")
    inlines = [ChannelMemberInline]
# ======================================================================================================================
class ChannelMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "channel", "sender", "message_type", "created_date")
    list_filter = ("message_type", "channel")
    search_fields = ("text",)
# ======================================================================================================================
admin.site.register(ChannelModels, ChannelAdmin)
admin.site.register(ChannelMessage, ChannelMessageAdmin)