from django.urls import re_path
from .consumers import CallSignalingConsumer
# ======================================================================================================================
websocket_urlpatterns = [
    re_path(r"ws/call/$", CallSignalingConsumer.as_asgi()),
]
# ======================================================================================================================