import os
from urllib.parse import parse_qs
from django.core.asgi import get_asgi_application
from django.contrib.auth.models import AnonymousUser
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.middleware import BaseMiddleware
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from jwt import InvalidTokenError
from asgiref.sync import sync_to_async
from chat import routing as chat_routing
from groups import routing as groups_routing
# ======================================================================================================================
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django_asgi_app = get_asgi_application()
# ======================================================================================================================
class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware برای WebSocket با JWT
    """
    async def __call__(self, scope, receive, send):
        # پیش فرض: Anonymous
        scope["user"] = AnonymousUser()

        # گرفتن token از query_string
        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token")
        if token:
            token = token[0]
            try:
                # اعتبار سنجی JWT
                validated_token = UntypedToken(token)
                auth = JWTAuthentication()
                user = await sync_to_async(auth.get_user)(validated_token)
                scope["user"] = user
                print(f"✅ WebSocket JWT user authenticated: {user.email}")
            except InvalidTokenError:
                print("❌ Invalid JWT token")
            except Exception as e:
                print("❌ JWT middleware error:", e)
        else:
            print("❌ No JWT token provided")

        return await super().__call__(scope, receive, send)
# ======================================================================================================================
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            chat_routing.websocket_urlpatterns + groups_routing.websocket_urlpatterns
        )
    ),
})
# ======================================================================================================================