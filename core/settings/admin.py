from django.contrib import admin
from .models import UserSettings
# ======================================================================================================================
@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "language", "dark_theme", "notif_messages","chat_wallpaper","last_backup_date","updated_date")
    search_fields = ("user__username", "user__email")
# ======================================================================================================================