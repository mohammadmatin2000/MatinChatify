import json
import logging
from django.conf import settings as django_settings
from pywebpush import webpush, WebPushException
from .models import PushSubscription
# ======================================================================================================================
logger = logging.getLogger(__name__)


def send_web_push(user, title, body, icon=None, url="/"):

    subscriptions = PushSubscription.objects.filter(user=user)
    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": icon or "/icons/icon-192.png",
        "url": url,
    })

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=django_settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{django_settings.VAPID_ADMIN_EMAIL}"},
            )
        except WebPushException as e:
            status_code = e.response.status_code if e.response else None
            if status_code in (404, 410):
                sub.delete()
            else:
                logger.error("Web push error for user %s: %s", user, e)
# ======================================================================================================================