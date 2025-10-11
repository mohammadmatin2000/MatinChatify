import json
import base64
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from chat.models import MessageModels
from django.utils.timezone import now
from django.core.files.base import ContentFile

# ✅ لیست سراسری کاربران آنلاین
online_users_list = set()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.user_id = self.user.id if self.user.is_authenticated else None
        self.room_name = self.scope["url_route"]["kwargs"].get("room_name")
        self.room_group_name = f"chat_{self.room_name}" if self.room_name else None

        await self.accept()
        print(f"✅ WS connected: {self.channel_name} | user_id={self.user_id}")

        # 👤 اضافه شدن به لیست کاربران آنلاین
        if self.user_id:
            online_users_list.add(self.user_id)
            await self.channel_layer.group_add("online_users", self.channel_name)
            await self.broadcast_online_users()

        # 💬 اضافه شدن به گروه روم (درصورت وجود)
        if self.room_group_name:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        # 📤 پیام اتصال موفق
        await self.send(text_data=json.dumps({
            "message": {
                "text": "✅ Connected",
                "senderId": None,
                "receiverId": None,
                "createdAt": str(now()),
            }
        }))

    async def disconnect(self, close_code):
        print(f"🔌 WS disconnected: {self.channel_name} | user_id={self.user_id}")

        if self.room_group_name:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        if self.user_id:
            online_users_list.discard(self.user_id)
            await self.broadcast_online_users()
            await self.channel_layer.group_discard("online_users", self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
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

    # ------------------ پیام جدید ------------------
    async def handle_chat_message(self, msg):
        sender_id = msg.get("senderId")
        receiver_id = msg.get("receiverId")
        temp_id = msg.get("tempId")
        text = msg.get("text", "")
        image_base64 = msg.get("image")

        if not text and not image_base64:
            await self.send(text_data=json.dumps({"error": "Empty message"}))
            return

        image_file = None
        if image_base64 and image_base64.startswith("data:image"):
            try:
                fmt, imgstr = image_base64.split(";base64,")
                ext = fmt.split("/")[-1]
                image_file = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")
            except Exception as e:
                print("⚠️ Image decode error:", e)

        room_name = "_".join(sorted([str(sender_id), str(receiver_id)]))
        self.room_group_name = f"chat_{room_name}"

        saved = await sync_to_async(MessageModels.objects.create)(
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            image=image_file,
        )

        message = {
            "id": saved.id,
            "tempId": temp_id,
            "text": saved.text,
            "senderId": sender_id,
            "receiverId": receiver_id,
            "image": saved.image.url if saved.image else None,
            "createdAt": str(saved.created_date),
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message", "message": message}
        )
        print(f"✅ Message saved and broadcasted: {saved.id}")

    # ------------------ ویرایش پیام ------------------
    async def handle_edit_message(self, data):
        message_id = data.get("messageId")
        new_text = data.get("newText")
        if not message_id or not new_text:
            return

        try:
            msg_obj = await sync_to_async(MessageModels.objects.get)(id=message_id)
            msg_obj.text = new_text
            await sync_to_async(msg_obj.save)()

            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "edit_message", "messageId": message_id, "newText": new_text}
            )
        except MessageModels.DoesNotExist:
            pass

    # ------------------ حذف پیام ------------------
    async def handle_delete_message(self, data):
        message_id = data.get("messageId")
        if not message_id:
            return

        await sync_to_async(MessageModels.objects.filter(id=message_id).delete)()
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "delete_message", "messageId": message_id}
        )

    # ------------------ Broadcasts پیام ------------------
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

    # ------------------ وضعیت آنلاین ------------------
    async def broadcast_online_users(self):
        online_list = list(online_users_list)
        print("📡 Broadcasting online users:", online_list)
        await self.channel_layer.group_send(
            "online_users",
            {
                "type": "update_online_users",
                "onlineUsers": online_list,
            }
        )

    async def update_online_users(self, event):
        await self.send(text_data=json.dumps({
            "type": "update_online_users",
            "onlineUsers": event["onlineUsers"],
        }))
