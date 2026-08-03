from django.urls import re_path
from .consumers import ChannelConsumer
# ======================================================================================================================
# مسیر WebSocket برای کانال‌ها
websocket_urlpatterns = [
    re_path(r'ws/channels/(?P<channel_id>\d+)/$', ChannelConsumer.as_asgi()),
]
# ======================================================================================================================