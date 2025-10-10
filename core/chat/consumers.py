import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from chat.models import MessageModels
from django.utils.timezone import now


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope["user"].id if self.scope["user"].is_authenticated else None
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        print(f"✅ WebSocket connected: {self.channel_name} -> {self.room_group_name}")

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
            print("🟢 Backend received:", data)

            msg_type = data.get("type")
            msg = data.get("message")

            if msg_type == "chat_message":
                await self.handle_chat_message(msg)
            elif msg_type == "edit_message":
                await self.handle_edit_message(data)
            elif msg_type == "delete_message":
                await self.handle_delete_message(data)
            else:
                await self.send(text_data=json.dumps({"error": "Invalid message type"}))
        except Exception as e:
            print("❌ Backend receive error:", e)
            await self.send(text_data=json.dumps({"error": str(e)}))

    # ✅ ایجاد پیام جدید
    async def handle_chat_message(self, msg):
        sender_id = msg.get("senderId")
        receiver_id = msg.get("receiverId")
        temp_id = msg.get("tempId")
        text = msg.get("text")
        image = msg.get("image")

        if not text:
            await self.send(text_data=json.dumps({"error": "Empty message"}))
            return

        room_name = "_".join(sorted([str(sender_id), str(receiver_id)]))
        self.room_group_name = f"chat_{room_name}"

        # ذخیره در دیتابیس
        saved = await sync_to_async(MessageModels.objects.create)(
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            image=image,
        )

        message = {
            "id": saved.id,  # 👈 id واقعی
            "tempId": temp_id,  # 👈 برای sync شدن با فرانت
            "text": saved.text,
            "senderId": sender_id,
            "receiverId": receiver_id,
            "image": saved.image or None,
            "createdAt": str(saved.created_date),
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message", "message": message},
        )

        print(f"✅ Message saved (id={saved.id}) and broadcasted")

    # ✏️ ویرایش پیام
    async def handle_edit_message(self, data):
        message_id = data.get("messageId")
        new_text = data.get("newText")

        if not message_id or not new_text:
            await self.send(text_data=json.dumps({"error": "Invalid edit request"}))
            return

        try:
            message_obj = await sync_to_async(MessageModels.objects.get)(id=message_id)
            message_obj.text = new_text
            await sync_to_async(message_obj.save)()

            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "edit_message", "messageId": message_id, "newText": new_text},
            )
            print(f"✅ Message {message_id} edited")

        except MessageModels.DoesNotExist:
            await self.send(text_data=json.dumps({"error": "Message not found"}))

    # 🗑 حذف پیام
    async def handle_delete_message(self, data):
        message_id = data.get("messageId")

        if not message_id:
            await self.send(text_data=json.dumps({"error": "Invalid delete request"}))
            return

        try:
            await sync_to_async(MessageModels.objects.filter(id=message_id).delete)()
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "delete_message", "messageId": message_id},
            )
            print(f"✅ Message {message_id} deleted")

        except Exception as e:
            await self.send(text_data=json.dumps({"error": str(e)}))

    # 📤 Broadcast‌ها
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"message": event["message"]}))

    async def edit_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "edit_message",
            "messageId": event["messageId"],
            "newText": event["newText"],
        }))

    async def delete_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "delete_message",
            "messageId": event["messageId"],
        }))
