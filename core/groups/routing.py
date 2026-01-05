from django.urls import re_path
from .consumers import GroupConsumer

# مسیر WebSocket برای گروه‌ها
websocket_urlpatterns = [
    re_path(r'ws/groups/(?P<group_id>\d+)/$', GroupConsumer.as_asgi()),
]
