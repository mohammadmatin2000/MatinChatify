import base64
import binascii
import uuid
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.base import ContentFile
from .models import Group, GroupMessages, GroupMember


class PermissionDeniedError(Exception):
    pass


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
    # ارسال پیام (متن/عکس/فایل/لوکیشن/مخاطب)
    # -------------------------
    async def handle_send_message(self, data):
        text = (data.get("text") or "").strip()
        message_type = data.get("messageType", "text")
        image_base64 = data.get("image")
        file_base64 = data.get("file")
        file_name = data.get("fileName")
        meta = data.get("meta")

        if not text and not image_base64 and not file_base64 and not meta:
            return

        # ✅ FIX: چک زنده‌ی عضویت به‌جای فلگ کش‌شده‌ی موقع connect — اگه کاربر
        # بعد از وصل‌شدن سوکت به گروه اضافه شده باشه هم بازم می‌تونه بفرسته.
        is_member_now = await self.is_member()
        self.is_member_flag = is_member_now
        if not is_member_now:
            await self.send_error("شما عضو این گروه نیستید")
            return

        try:
            message_data = await self.save_message(
                text=text,
                message_type=message_type,
                image_base64=image_base64,
                file_base64=file_base64,
                file_name=file_name,
                meta=meta,
            )
        except ObjectDoesNotExist:
            await self.send_error("گروه پیدا نشد")
            return
        except (ValueError, binascii.Error):
            await self.send_error("فایل ارسالی نامعتبر است")
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat_message", "message": message_data},
        )

    # -------------------------
    # ویرایش پیام (فقط نویسنده)
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
    # حذف پیام (فقط نویسنده)
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
            "is_member": event.get("is_member", False),
        }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({"type": "error", "message": message}))

    # -------------------------
    # DB helpers
    # -------------------------
    @database_sync_to_async
    def is_member(self):
        return GroupMember.objects.filter(user=self.user, group_id=self.group_id).exists()

    @database_sync_to_async
    def save_message(self, text, message_type="text", image_base64=None, file_base64=None, file_name=None, meta=None):
        group = Group.objects.get(id=self.group_id)

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

        message = GroupMessages.objects.create(
            group=group,
            author=self.user,
            text=text,
            message_type=message_type,
            image=image_file,
            file=doc_file,
            file_name=file_name if doc_file else None,
            meta=meta,
        )

        return self._serialize_message(message)

    @database_sync_to_async
    def edit_message(self, message_id, new_text):
        message = GroupMessages.objects.get(id=message_id, group_id=self.group_id)
        if message.author_id != self.user.id:
            raise PermissionDeniedError()
        message.text = new_text
        message.is_edited = True
        message.save(update_fields=["text", "is_edited", "updated_date"])

    @database_sync_to_async
    def delete_message(self, message_id):
        message = GroupMessages.objects.get(id=message_id, group_id=self.group_id)
        if message.author_id != self.user.id:
            raise PermissionDeniedError()
        message.is_deleted = True
        message.text = ""
        message.save(update_fields=["is_deleted", "text", "updated_date"])

    def serialize_user(self, user):
        return {
            "id": user.id,
            "email": getattr(user, "email", None),
        }

    def _serialize_message(self, message):
        return {
            "id": message.id,
            "text": message.text,
            "messageType": message.message_type,
            "image": message.image.url if message.image else None,
            "file": message.file.url if message.file else None,
            "fileName": message.file_name,
            "meta": message.meta,
            "sender": self.serialize_user(message.author),
            "created_date": message.created_date.isoformat(),
        }