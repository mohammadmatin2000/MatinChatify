from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ChannelViewSet, ChannelMessageViewSet
# ======================================================================================================================
router = DefaultRouter()
router.register(r"channels", ChannelViewSet, basename="channel")

urlpatterns = router.urls + [
    path(
        "channels/<int:channel_id>/messages/",
        ChannelMessageViewSet.as_view(),
        name="channel-messages",
    ),
]