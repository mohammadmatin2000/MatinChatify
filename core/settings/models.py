from django.conf import settings as django_settings
from django.db import models
# ======================================================================================================================

class VisibilityChoices(models.TextChoices):
    EVERYONE = "everyone", "Everyone"
    CONTACTS = "contacts", "My Contacts"
    NOBODY = "nobody", "Nobody"
# ======================================================================================================================

class FontSizeChoices(models.TextChoices):
    SMALL = "small", "Small"
    MEDIUM = "medium", "Medium"
    LARGE = "large", "Large"
# ======================================================================================================================

class LanguageChoices(models.TextChoices):
    FA = "fa", "فارسی"
    EN = "en", "English"

# ======================================================================================================================
class UserSettings(models.Model):
    user = models.OneToOneField(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settings",
    )

    # ---- Account / profile-adjacent ----
    about_text = models.CharField(max_length=140, blank=True, default="سلام! من از چتیفای استفاده می‌کنم.")
    two_step_enabled = models.BooleanField(default=False)

    # ---- Privacy ----
    last_seen_visibility = models.CharField(
        max_length=10, choices=VisibilityChoices.choices, default=VisibilityChoices.EVERYONE
    )
    photo_visibility = models.CharField(
        max_length=10, choices=VisibilityChoices.choices, default=VisibilityChoices.EVERYONE
    )
    about_visibility = models.CharField(
        max_length=10, choices=VisibilityChoices.choices, default=VisibilityChoices.EVERYONE
    )
    read_receipts = models.BooleanField(default=True)
    online_status_visible = models.BooleanField(default=True)

    # ---- Notifications ----
    notif_messages = models.BooleanField(default=True)
    notif_groups = models.BooleanField(default=True)
    notif_calls = models.BooleanField(default=True)
    notif_preview = models.BooleanField(default=True)
    notif_vibrate = models.BooleanField(default=True)
    sound_enabled = models.BooleanField(default=True)

    # ---- Chats ----
    dark_theme = models.BooleanField(default=True)
    enter_to_send = models.BooleanField(default=True)
    font_size = models.CharField(max_length=10, choices=FontSizeChoices.choices, default=FontSizeChoices.MEDIUM)

    # ---- Storage & data ----
    auto_download_wifi = models.BooleanField(default=True)
    auto_download_mobile = models.BooleanField(default=False)

    # ---- Language ----
    language = models.CharField(max_length=5, choices=LanguageChoices.choices, default=LanguageChoices.FA)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Settings"
        verbose_name_plural = "User Settings"

    def __str__(self):
        return f"Settings<{self.user}>"
# ======================================================================================================================