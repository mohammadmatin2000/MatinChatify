from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.sessions.models import Session
from .models import User, Profile


# ======================================================================================================================
# Custom Django Admin Configuration for User model
class CustomUserAdmin(UserAdmin):
    model = User  # Specifies the model that this admin class is based on

    # Defines the fields displayed in the admin panel list view
    list_display = (
        "id",
        "email",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_verified",
    )

    # Fields used for filtering results in the admin panel
    list_filter = (
        "email",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_verified",
    )

    # Fields used for searching users in the admin panel
    search_fields = ("email",)

    # Orders the results by the email field
    ordering = ("email",)

    # Defines how the user details are grouped and displayed in the admin panel
    fieldsets = (
        (
            "Authentication",
            {"fields": ("email", "password")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_staff",
                    "is_superuser",
                    "is_active",
                    "is_verified",
                    "type",
                )
            },
        ),
        (
            "Group Permissions",
            {"fields": ("groups", "user_permissions")},
        ),
        (
            "Important Date",
            {"fields": ("last_login",)},
        ),
    )

    # Configuration for adding a new user from the admin panel
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),  # Styling applied to the form
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "is_staff",  # Required fields for creating a new user
                    "is_active",
                    "is_superuser",
                ),
            },
        ),
    )


class SessionAdmin(admin.ModelAdmin):
    def _session_data(self, obj):
        return obj.get_decoded()

    list_display = ["session_key", "_session_data", "expire_date"]


# ======================================================================================================================
# Registers the User model with the custom admin configuration
admin.site.register(User, CustomUserAdmin)

# Registers the Profile model in the admin panel
admin.site.register(Profile)

admin.site.register(Session, SessionAdmin)
# ======================================================================================================================