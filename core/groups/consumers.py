import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import Group, GroupMessages, GroupMember
# ======================================================================================================================
class GroupConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = int(self.scope["url_route"]["kwargs"]["group_id"])
        self.group_name = f"group_{self.group_id}"
        self.user = self.scope.get("user")

        # بررسی JWT
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return

        # ✅ FIX: این فلگ فقط برای broadcast کردن رویداد join/leave استفاده می‌شه،
        # نه برای تصمیم‌گیری در مورد اجازه‌ی ارسال پیام. برای ارسال پیام همیشه
        # وضعیت عضویت رو "زنده" از دیتابیس چک می‌کنیم (پایین‌تر در receive).
        # قبلاً این مقدار فقط همین یک‌بار موقع اتصال محاسبه و کش می‌شد؛ اگه کاربر
        # با سوکت باز مونده بود و بعداً به گروه اضافه می‌شد (یا حذف می‌شد)، این
        # مقدار قدیمی/غلط می‌موند و پیام‌هاش بی‌صدا (بدون هیچ خطایی) دراپ می‌شدن.
        self.is_member_flag = await self.is_member()

        # اضافه کردن کانال به گروه حتی اگر عضو نباشه
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # اطلاع سایر کاربران از ورود کاربر
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_event",
                "event": "joined",
                "user": self.serialize_user(self.user),
                "is_member": self.is_member_flag,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if self.user and not self.user.is_anonymous:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user_event",
                    "event": "left",
                    "user": self.serialize_user(self.user),
                    "is_member": self.is_member_flag,
                }
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            await self.send_error("داده‌ی نامعتبر ارسال شد")
            return

        if data.get("action") != "message":
            return

        text = (data.get("text") or "").strip()
        if not text:
            return

        # ✅ FIX: چک زنده‌ی عضویت به‌جای تکیه بر self.is_member_flag کش‌شده.
        # این‌جوری اگه کاربر بعد از وصل‌شدن سوکت به گروه اضافه شده باشه، بازم
        # می‌تونه پیام بفرسته بدون نیاز به رفرش/reconnect.
        is_member_now = await self.is_member()
        self.is_member_flag = is_member_now

        if not is_member_now:
            # ✅ FIX: قبلاً اینجا کاملاً سکوت می‌کرد. الان به فرانت‌اند خبر می‌دیم
            # که چرا پیام ارسال نشد، تا دیگه به نظر نرسه که "چیزی کار نمی‌کنه".
            await self.send_error("شما عضو این گروه نیستید")
            return

        try:
            message = await self.save_message(text)
        except ObjectDoesNotExist:
            await self.send_error("گروه پیدا نشد")
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "message": self.serialize_message(message),
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"type": "message", **event["message"]}))

    async def user_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "user_event",
            "event": event.get("event"),
            "user": event.get("user"),
            "is_member": event.get("is_member", False),
        }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({
            "type": "error",
            "message": message,
        }))

    @database_sync_to_async
    def is_member(self):
        return GroupMember.objects.filter(user=self.user, group_id=self.group_id).exists()

    @database_sync_to_async
    def save_message(self, text):
        group = Group.objects.get(id=self.group_id)
        return GroupMessages.objects.create(group=group, author=self.user, text=text)

    # ----------------------------------------------
    # Serializer امن برای User فقط با ایمیل
    # ----------------------------------------------
    def serialize_user(self, user):
        return {
            "id": user.id,
            "email": getattr(user, "email", None),
        }

    # ----------------------------------------------
    # Serializer پیام برای WebSocket
    # ----------------------------------------------
    def serialize_message(self, message):
        return {
            "id": message.id,
            "text": message.text,
            "sender": self.serialize_user(message.author),
            "created_date": message.created_date.isoformat()
        }
# ======================================================================================================================