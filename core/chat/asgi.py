import os
from django.core.asgi import get_asgi_application
from django.urls import path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from chat.consumers import MessageConsumer  # مسیر درست به consumers

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_project.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            # مسیر WebSocket با chat_id
            path("ws/chat/<int:chat_id>/", MessageConsumer.as_asgi()),
        ])
    ),
})
