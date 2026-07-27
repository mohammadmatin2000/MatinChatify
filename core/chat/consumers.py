import base64
import uuid
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from django.utils.timezone import now
from django.core.files.base import ContentFile
from chat.models import MessageModels,ContactModels
# ======================================================================================================================
# ✅ لیست سراسری کاربران آنلاین
online_users_list = set()
# ======================================================================================================================
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.user_id = self.user.id if self.user.is_authenticated else None

        if not self.user_id:
            await self.close()
            return

        # room_name کاربر مقابل
        self.room_name = self.scope["url_route"]["kwargs"].get("room_name")
        if not self.room_name:
            await self.close()
            return

        # نام گروه مشترک بین دو کاربر
        self.room_group_name = f"chat_{'_'.join(sorted([str(self.user_id), str(self.room_name)]))}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        print(f"✅ WS connected: {self.channel_name} | user_id={self.user_id} | room={self.room_group_name}")

        # پیام اتصال موفق
        await self.send(text_data=json.dumps({
            "type": "connection",
            "message": {
                "text": "✅ Connected",
                "senderId": None,
                "receiverId": None,
                "createdAt": str(now()),
            }
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"🔌 WS disconnected: {self.channel_name} | user_id={self.user_id} | room={self.room_group_name}")

    async def receive(self, text_data=None):
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
                await self.send(json.dumps({"error": "Invalid message type"}))
        except Exception as e:
            print("❌ WS receive error:", e)
            await self.send(json.dumps({"error": str(e)}))

    # -------------------- ارسال پیام جدید --------------------
    async def handle_chat_message(self, msg):
        sender_id = msg.get("senderId")
        receiver_id = msg.get("receiverId")
        temp_id = msg.get("tempId")
        text = msg.get("text", "")
        image_base64 = msg.get("image")

        if not text and not image_base64:
            await self.send(json.dumps({"error": "Empty message"}))
            return

        image_file = None
        if image_base64 and image_base64.startswith("data:image"):
            try:
                fmt, imgstr = image_base64.split(";base64,")
                ext = fmt.split("/")[-1]
                image_file = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")
            except Exception as e:
                print("⚠️ Image decode error:", e)

        # ذخیره در دیتابیس
        saved = await sync_to_async(MessageModels.objects.create)(
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            image=image_file,
        )

        message_data = {
            "id": saved.id,
            "tempId": temp_id,
            "text": saved.text,
            "senderId": sender_id,
            "receiverId": receiver_id,
            "image": saved.image.url if saved.image else None,
            "createdAt": str(saved.created_date),
        }

        # broadcast به گروه مشترک
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message_broadcast",
                "message": message_data,
            }
        )
        print(f"✅ Message saved and broadcasted: {saved.id}")

    async def chat_message_broadcast(self, event):
        # ارسال به کل اعضای گروه
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"]
        }))

    # -------------------- ویرایش پیام --------------------
    async def handle_edit_message(self, data):
        message_id = data.get("messageId")
        new_text = data.get("newText")
        if not message_id or new_text is None:
            return
        try:
            msg_obj = await sync_to_async(MessageModels.objects.get)(id=message_id)
            msg_obj.text = new_text
            await sync_to_async(msg_obj.save)()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "edit_message_broadcast",
                    "messageId": message_id,
                    "newText": new_text
                }
            )
            print(f"✏️ Message edited: {message_id}")
        except MessageModels.DoesNotExist:
            print(f"⚠️ Message to edit not found: {message_id}")

    async def edit_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "edit_message",
            "messageId": event["messageId"],
            "newText": event["newText"],
        }))

    # -------------------- حذف پیام --------------------
    async def handle_delete_message(self, data):
        message_id = data.get("messageId")
        if not message_id:
            return
        await sync_to_async(MessageModels.objects.filter(id=message_id).delete)()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "delete_message_broadcast",
                "messageId": message_id
            }
        )
        print(f"🗑️ Message deleted: {message_id}")

    async def delete_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "delete_message",
            "messageId": event["messageId"]
        }))
# ======================================================================================================================
# نگهداری تعداد اتصال هر کاربر
online_users_map = {}
# ======================================================================================================================
class OnlineStatusConsumer(AsyncWebsocketConsumer):

    online_users = {}

    async def connect(self):
        user = self.scope["user"]

        if user.is_anonymous:
            await self.close()
            return

        self.user = user
        self.user_id = user.id
        self.group_name = f"user_{self.user_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        self.online_users[self.user_id] = (
            self.online_users.get(self.user_id, 0) + 1
        )

        contacts = await self.get_contacts()

        await self.send(
            text_data=json.dumps({
                "type": "contacts_list",
                "contacts": contacts,
            })
        )

        if self.online_users[self.user_id] == 1:
            await self.broadcast_presence(True)

    async def disconnect(self, code):

        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )

        if self.user_id not in self.online_users:
            return

        self.online_users[self.user_id] -= 1

        if self.online_users[self.user_id] <= 0:
            del self.online_users[self.user_id]

            await self.broadcast_presence(False)

    async def receive(self, text_data):

        data = json.loads(text_data)

        if data.get("type") == "get_contacts":
            contacts = await self.get_contacts()

            await self.send(
                text_data=json.dumps({
                    "type": "contacts_list",
                    "contacts": contacts,
                })
            )

    async def presence_update(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "presence_update",
                "userId": event["userId"],
                "online": event["online"],
            })
        )

    # -------------------- توابع کمکی --------------------
    @database_sync_to_async
    def get_contacts(self):

        contacts = (
            ContactModels.objects
            .filter(user=self.user)
            .select_related(
                "contact",
                "contact__user_profile"
            )
        )

        result = []

        for item in contacts:
            profile = item.contact.user_profile

            result.append({

                "id": item.contact.id,

                "email": item.contact.email,

                "name": profile.get_fullname(),

                "image": profile.image.url if profile.image else None,

                "online": item.contact.id in self.online_users,

            })

        return result

    @database_sync_to_async
    def get_watchers(self):

        return list(

            ContactModels.objects.filter(

                contact_id=self.user_id

            ).values_list(

                "user_id",

                flat=True,

            )

        )

    async def broadcast_presence(self, online):

        users = await self.get_watchers()

        for uid in users:
            await self.channel_layer.group_send(

                f"user_{uid}",

                {

                    "type": "presence_update",

                    "userId": self.user_id,

                    "online": online,

                },

            )
# ======================================================================================================================
