import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from chat.models import MessageModels, ChatModels
from accounts.models import User
from datetime import datetime

class MessageConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # بررسی احراز هویت
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return

        self.user = user
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.room_group_name = f"chat_{self.chat_id}"

        # اتصال به گروه
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # جدا شدن از گروه
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # دریافت پیام از WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_text = data.get("text", None)
        receiver_id = data.get("receiverId", None)
        image = data.get("image", None)

        if not message_text and not image:
            # هیچ چیزی برای ارسال وجود ندارد
            return

        # ذخیره پیام در دیتابیس
        message = await self.create_message(self.user.id, receiver_id, message_text, image)

        # آماده‌سازی دیتا برای فرانت
        message_dict = {
            "id": message.id,
            "senderId": message.sender.id,
            "receiverId": message.receiver.id,
            "text": message.text,
            "image": message.image.url if message.image else None,
            "createdAt": message.created_date.isoformat()
        }

        # ارسال پیام به همه اعضای گروه
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "new_message",
                "message": message_dict
            }
        )

    # دریافت پیام از گروه و ارسال به فرانت
    async def new_message(self, event):
        await self.send(text_data=json.dumps({
            "event": "newMessage",
            "data": event["message"]
        }))

    @database_sync_to_async
    def create_message(self, sender_id, receiver_id, text, image):
        sender = User.objects.get(id=sender_id)
        receiver = User.objects.get(id=receiver_id)
        message = MessageModels.objects.create(
            sender=sender,
            receiver=receiver,
            text=text,
            image=image
        )
        # می‌توان اینجا چت آخر را هم آپدیت کرد
        chat, _ = ChatModels.objects.get_or_create(id=self.chat_id)
        chat.last_message = message
        chat.save()
        return message
