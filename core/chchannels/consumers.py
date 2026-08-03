import base64
import binascii
import uuid
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.base import ContentFile
from .models import ChannelModels, ChannelMessage, ChannelMember
# ======================================================================================================================
class PermissionDeniedError(Exception):
    pass
# ======================================================================================================================
class ChannelConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.channel_id = int(self.scope["url_route"]["kwargs"]["channel_id"])
        self.group_name = f"channel_{self.channel_id}"
        self.user = self.scope.get("user")

        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return

        self.my_role = await self.get_my_role()
        if not self.my_role:
            # عضو این کانال نیست، اجازه‌ی اتصال نداره
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_event",
                "event": "joined",
                "user": self.serialize_user(self.user),
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
                }
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            await self.send_error("داده‌ی نامعتبر ارسال شد")
            return

        action = data.get("action")

        if action == "message":
            await self.handle_send_message(data)
        elif action == "edit_message":
            await self.handle_edit_message(data)
        elif action == "delete_message":
            await self.handle_delete_message(data)
        # اکشن‌های ناشناخته سایلنت نادیده گرفته می‌شن

    # -------------------------
    # ارسال پیام (فقط ادمین کانال)
    # -------------------------
    async def handle_send_message(self, data):
        text = (data.get("text") or "").strip()
        message_type = data.get("messageType", "text")
        image_base64 = data.get("image")
        file_base64 = data.get("file")
        file_name = data.get("fileName")

        if not text and not image_base64 and not file_base64:
            return

        # ✅ چک زنده‌ی نقش به‌جای فلگ کش‌شده‌ی موقع connect
        my_role_now = await self.get_my_role()
        self.my_role = my_role_now
        if my_role_now != "admin":
            await self.send_error("فقط ادمین کانال می‌تونه پیام بذاره")
            return

        try:
            message_data = await self.save_message(
                text=text,
                message_type=message_type,
                image_base64=image_base64,
                file_base64=file_base64,
                file_name=file_name,
            )
        except ObjectDoesNotExist:
            await self.send_error("کانال پیدا نشد")
            return
        except (ValueError, binascii.Error):
            await self.send_error("فایل ارسالی نامعتبر است")
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat_message", "message": message_data},
        )

    # -------------------------
    # ویرایش پیام (فقط نویسنده‌ی پیام)
    # -------------------------
    async def handle_edit_message(self, data):
        message_id = data.get("messageId")
        new_text = (data.get("newText") or "").strip()
        if not message_id or not new_text:
            return

        try:
            await self.edit_message(message_id, new_text)
        except ObjectDoesNotExist:
            await self.send_error("پیام پیدا نشد")
            return
        except PermissionDeniedError:
            await self.send_error("فقط نویسنده‌ی پیام می‌تونه ویرایشش کنه")
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "edit_broadcast", "messageId": message_id, "newText": new_text},
        )

    # -------------------------
    # حذف پیام (فقط نویسنده‌ی پیام)
    # -------------------------
    async def handle_delete_message(self, data):
        message_id = data.get("messageId")
        if not message_id:
            return

        try:
            await self.delete_message(message_id)
        except ObjectDoesNotExist:
            await self.send_error("پیام پیدا نشد")
            return
        except PermissionDeniedError:
            await self.send_error("فقط نویسنده‌ی پیام می‌تونه حذفش کنه")
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "delete_broadcast", "messageId": message_id},
        )

    # -------------------------
    # Broadcast handlers
    # -------------------------
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"type": "message", **event["message"]}))

    async def edit_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "edit_message",
            "messageId": event["messageId"],
            "newText": event["newText"],
        }))

    async def delete_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "delete_message",
            "messageId": event["messageId"],
        }))

    async def user_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "user_event",
            "event": event.get("event"),
            "user": event.get("user"),
        }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({"type": "error", "message": message}))

    # -------------------------
    # DB helpers
    # -------------------------
    @database_sync_to_async
    def get_my_role(self):
        member = ChannelMember.objects.filter(
            user=self.user, channel_id=self.channel_id
        ).first()
        return member.role if member else None

    @database_sync_to_async
    def save_message(self, text, message_type="text", image_base64=None, file_base64=None, file_name=None):
        channel = ChannelModels.objects.get(id=self.channel_id)

        image_file = None
        if image_base64 and image_base64.startswith("data:image"):
            fmt, imgstr = image_base64.split(";base64,")
            ext = fmt.split("/")[-1]
            image_file = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")

        doc_file = None
        if file_base64 and ";base64," in file_base64:
            header, filestr = file_base64.split(";base64,")
            ext = (file_name.split(".")[-1] if file_name and "." in file_name else "bin")
            doc_file = ContentFile(base64.b64decode(filestr), name=f"{uuid.uuid4()}.{ext}")

        message = ChannelMessage.objects.create(
            channel=channel,
            sender=self.user,
            text=text,
            message_type=message_type,
            image=image_file,
            file=doc_file,
            file_name=file_name if doc_file else None,
        )

        return self._serialize_message(message)

    @database_sync_to_async
    def edit_message(self, message_id, new_text):
        message = ChannelMessage.objects.get(id=message_id, channel_id=self.channel_id)
        if message.sender_id != self.user.id:
            raise PermissionDeniedError()
        message.text = new_text
        message.save(update_fields=["text", "updated_date"])

    @database_sync_to_async
    def delete_message(self, message_id):
        message = ChannelMessage.objects.get(id=message_id, channel_id=self.channel_id)
        if message.sender_id != self.user.id:
            raise PermissionDeniedError()
        message.delete()

    def serialize_user(self, user):
        return {
            "id": user.id,
            "email": getattr(user, "email", None),
            "phone_number": getattr(user, "phone_number", None),
        }

    def _serialize_message(self, message):
        return {
            "id": message.id,
            "text": message.text,
            "messageType": message.message_type,
            "image": message.image.url if message.image else None,
            "file": message.file.url if message.file else None,
            "fileName": message.file_name,
            "sender": self.serialize_user(message.sender),
            "created_date": message.created_date.isoformat(),
        }
# ======================================================================================================================