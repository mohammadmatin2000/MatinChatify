import json
from channels.generic.websocket import AsyncWebsocketConsumer
# ======================================================================================================================
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f"chat_{self.room_name}"


        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        await self.send(text_data=json.dumps({
            "message": f"✅ Connected to chat room: {self.room_name}"
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
            message = data.get("message", "")

            if not message.strip():
                await self.send(text_data=json.dumps({
                    "error": "⚠️ Message cannot be empty."
                }))
                return


            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": message
                }
            )

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "error": "❌ Invalid JSON format."
            }))

    async def chat_message(self, event):
        message = event["message"]

        await self.send(text_data=json.dumps({
            "message": message
        }))
# ======================================================================================================================