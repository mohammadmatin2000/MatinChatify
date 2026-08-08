from django.contrib import admin
from .models import UserSettings
# ======================================================================================================================
@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "language", "dark_theme", "notif_messages", "updated_at")
    search_fields = ("user__username", "user__email")
# ======================================================================================================================