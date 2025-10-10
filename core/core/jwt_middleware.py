from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth import get_user_model
from jwt import InvalidTokenError
User = get_user_model()
# ======================================================================================================================
class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token")
        scope["user"] = AnonymousUser()

        if token:
            token = token[0]
            try:
                validated_token = UntypedToken(token)
                auth = JWTAuthentication()
                user, _ = auth.get_user(validated_token), validated_token
                scope["user"] = user
            except InvalidTokenError:
                pass
        return await super().__call__(scope, receive, send)
# ======================================================================================================================