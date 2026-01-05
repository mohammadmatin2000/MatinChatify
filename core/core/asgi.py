import os
from urllib.parse import parse_qs

from django.core.asgi import get_asgi_application
from django.contrib.auth.models import AnonymousUser

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.middleware import BaseMiddleware

from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from jwt import InvalidTokenError, ExpiredSignatureError

from asgiref.sync import sync_to_async

from chat.routing import websocket_urlpatterns as chat_ws
from groups.routing import websocket_urlpatterns as groups_ws

# =====================================================================
# تنظیمات Django
# =====================================================================
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django_asgi_app = get_asgi_application()

# =====================================================================
# JWT Middleware برای WebSocket
# =====================================================================
class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware امن برای احراز هویت WebSocket با JWT
    پشتیبانی از Custom User بدون username
    """

    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()

        try:
            query_string = parse_qs(scope.get("query_string", b"").decode())
            token_list = query_string.get("token")

            if not token_list:
                print("❌ WS No token provided")
                return await super().__call__(scope, receive, send)

            token = token_list[0]

            # اعتبارسنجی JWT
            validated_token = UntypedToken(token)
            auth = JWTAuthentication()
            user = await sync_to_async(auth.get_user)(validated_token)
            scope["user"] = user

            # Safe log: چون username نداریم، فقط ایمیل نمایش میدیم
            print(f"✅ WS user authenticated: {getattr(user, 'email', 'unknown')}")

        except ExpiredSignatureError:
            print("❌ WS Token expired")
            return await self.reject_connection(scope, receive, send)
        except InvalidTokenError:
            print("❌ WS Invalid token")
            return await self.reject_connection(scope, receive, send)
        except Exception as e:
            print("❌ WS middleware error:", e)
            return await self.reject_connection(scope, receive, send)

        return await super().__call__(scope, receive, send)

    async def reject_connection(self, scope, receive, send):
        """
        اتصال WebSocket نامعتبر را reject می‌کند.
        """
        await send({
            "type": "websocket.close",
            "code": 4003  # Forbidden
        })

# =====================================================================
# ASGI Application
# =====================================================================
application = ProtocolTypeRouter({
    "http": django_asgi_app,  # HTTP معمولی Django
    "websocket": JWTAuthMiddleware(
        URLRouter(
            chat_ws + groups_ws  # همه WebSocket URL ها
        )
    ),
})
