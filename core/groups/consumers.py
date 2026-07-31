import base64
import uuid
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.files.base import ContentFile
from .models import Group, GroupMessages, GroupMember

class GroupConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = int(self.scope["url_route"]["kwargs"]["group_id"])
        self.group_name = f"group_{self.group_id}"
        self.user = self.scope.get("user")

        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return

        self.is_member_flag = await self.is_member()

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

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
            text = (data.get("text") or "").strip()
            message_type = data.get("messageType", "text")
            image_base64 = data.get("image")
            file_base64 = data.get("file")
            file_name = data.get("fileName")
            meta = data.get("meta")

            if not text and not image_base64 and not file_base64 and not meta:
                return

            message = await self.save_message(
                text=text,
                message_type=message_type,
                image_base64=image_base64,
                file_base64=file_base64,
                file_name=file_name,
                meta=meta,
            )
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "chat_message", "message": self.serialize_message(message)}
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
    def save_message(self, text, message_type="text", image_base64=None, file_base64=None, file_name=None, meta=None):
        group = Group.objects.get(id=self.group_id)

        image_file = None
        if image_base64 and image_base64.startswith("data:image"):
            try:
                fmt, imgstr = image_base64.split(";base64,")
                ext = fmt.split("/")[-1]
                image_file = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")
            except Exception as e:
                print("⚠️ Image decode error:", e)

        doc_file = None
        if file_base64 and ";base64," in file_base64:
            try:
                header, filestr = file_base64.split(";base64,")
                ext = (file_name.split(".")[-1] if file_name and "." in file_name else "bin")
                doc_file = ContentFile(base64.b64decode(filestr), name=f"{uuid.uuid4()}.{ext}")
            except Exception as e:
                print("⚠️ File decode error:", e)

        return GroupMessages.objects.create(
            group=group,
            author=self.user,
            text=text,
            message_type=message_type,
            image=image_file,
            file=doc_file,
            file_name=file_name if doc_file else None,
            meta=meta,
        )

    def serialize_user(self, user):
        return {
            "id": user.id,
            "email": getattr(user, "email", None),
        }

    def serialize_message(self, message):
        return {
            "id": message.id,
            "text": message.text,
            "messageType": message.message_type,
            "image": message.image.url if message.image else None,
            "file": message.file.url if message.file else None,
            "fileName": message.file_name,
            "meta": message.meta,
            "sender": self.serialize_user(message.author),
            "created_date": message.created_date.isoformat()
        }