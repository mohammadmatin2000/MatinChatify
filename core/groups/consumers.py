import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Group, GroupMessages, GroupMember

class GroupConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = int(self.scope["url_route"]["kwargs"]["group_id"])
        self.group_name = f"group_{self.group_id}"
        self.user = self.scope.get("user")

        # بررسی JWT
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return

        # بررسی عضویت در گروه بدون ریجکت
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
        data = json.loads(text_data)

        if data.get("action") == "message" and self.is_member_flag:
            text = data.get("text", "").strip()
            if not text:
                return
            message = await self.save_message(text)
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
