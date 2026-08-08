from django.urls import path
from .views import ChangePasswordView, DeleteAccountView, UserSettingsView
# ======================================================================================================================
urlpatterns = [
    path("", UserSettingsView.as_view(), name="user-settings"),
    path("change-password/", ChangePasswordView.as_view(), name="settings-change-password"),
    path("delete-account/", DeleteAccountView.as_view(), name="settings-delete-account"),
]
# ======================================================================================================================