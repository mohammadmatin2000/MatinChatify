from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    ChannelViewSet, ChannelMessageViewSet,
    ChannelMemberRoleView, ChannelMemberRemoveView,
)
# ======================================================================================================================
router = DefaultRouter()
router.register(r"channels", ChannelViewSet, basename="channel")

urlpatterns = router.urls + [
    path(
        "channels/<int:channel_id>/messages/",
        ChannelMessageViewSet.as_view(),
        name="channel-messages",
    ),
    path(
        "channels/<int:channel_id>/members/<int:member_id>/role/",
        ChannelMemberRoleView.as_view(),
        name="channel-member-role",
    ),
    path(
        "channels/<int:channel_id>/members/<int:member_id>/remove/",
        ChannelMemberRemoveView.as_view(),
        name="channel-member-remove",
    ),
]

# ======================================================================================================================