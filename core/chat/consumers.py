import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from chat.models import MessageModels
from django.utils.timezone import now

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['user'].id  # اگر از AuthMiddleware استفاده می‌کنید
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f"chat_{self.room_name}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        print(f"✅ WebSocket connected: {self.channel_name} in room {self.room_group_name}")

        await self.send(text_data=json.dumps({
            "message": {
                "text": f"✅ Connected to chat room: {self.room_name}",
                "senderId": None,
                "receiverId": None,
                "createdAt": str(now()),
            }
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"🔌 WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
            print("🟢 Backend received data:", data)

            msg = data.get("message")
            if not msg or not msg.get("text"):
                await self.send(text_data=json.dumps({"error": "پیام خالی است"}))
                print("⚠️ پیام خالی دریافت شد")
                return

            sender_id = msg.get("senderId")
            receiver_id = msg.get("receiverId")

            # room مشترک بین دو کاربر
            room_name = "_".join(sorted([str(sender_id), str(receiver_id)]))
            self.room_group_name = f"chat_{room_name}"

            message = {
                "text": msg.get("text"),
                "senderId": sender_id,
                "receiverId": receiver_id,
                "tempId": msg.get("tempId"),
                "image": msg.get("image") or None,
                "createdAt": str(now()),
            }

            print(f"🟡 Sending message to room {self.room_group_name}:", message)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": message
                }
            )

            if sender_id and receiver_id:
                await sync_to_async(MessageModels.objects.create)(
                    sender_id=sender_id,
                    receiver_id=receiver_id,
                    text=message["text"],
                    image=message["image"]
                )
                print("✅ Message saved in DB")

        except Exception as e:
            print("❌ Backend receive error:", e)
            await self.send(text_data=json.dumps({"error": str(e)}))

    async def chat_message(self, event):
        message = event["message"]
        print("📩 Backend sending chat_message event:", message)
        await self.send(text_data=json.dumps({"message": message}))
