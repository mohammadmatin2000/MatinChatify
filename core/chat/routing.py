# chat/routing.py
from django.urls import re_path
from .consumers import ChatConsumer, OnlineStatusConsumer,CallSignalingConsumer

websocket_urlpatterns = [
    # WebSocket برای پیام‌های خصوصی (چت)
    re_path(r'ws/chat/(?P<room_name>[^/]+)/$', ChatConsumer.as_asgi()),

    # WebSocket برای وضعیت آنلاین کاربران (کانتکت لیست)
    re_path(r'ws/online-status/$', OnlineStatusConsumer.as_asgi()),

    re_path(r"ws/call/$", CallSignalingConsumer.as_asgi()),
]
