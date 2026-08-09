from django.urls import path
from .views import (ChangePasswordView, DeleteAccountView, UserSettingsView,
                    StorageUsageSummaryView,StorageItemsListView,DeleteStorageItemView,BackupChatsView)
# ======================================================================================================================
urlpatterns = [
    path("", UserSettingsView.as_view(), name="user-settings"),
    path("change-password/", ChangePasswordView.as_view(), name="settings-change-password"),
    path("delete-account/", DeleteAccountView.as_view(), name="settings-delete-account"),

    # مدیریت فضای ذخیره‌سازی
    path("storage-usage/", StorageUsageSummaryView.as_view(), name="storage-usage-summary"),
    path("storage-usage/items/", StorageItemsListView.as_view(), name="storage-usage-items"),
    path("storage-usage/items/<int:message_id>/", DeleteStorageItemView.as_view(), name="storage-usage-item-delete"),
    # پشتیبان‌گیری از چت‌ها
    path("backup-chats/", BackupChatsView.as_view(), name="backup-chats"),
]
# ======================================================================================================================