import base64
import uuid
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from django.utils.timezone import now
from django.core.files.base import ContentFile
from django.db.models import Q
from chat.models import MessageModels, ContactModels, BlockModels
from accounts.models import User
# ======================================================================================================================
online_users_list = set()
# ======================================================================================================================
class ChatConsumer(AsyncWebsocketConsumer):

    # -------------------- اتصال --------------------
    async def connect(self):
        self.user = self.scope["user"]
        self.user_id = self.user.id if self.user.is_authenticated else None

        if not self.user_id:
            await self.close(code=4001)
            return

        self.room_name = self.scope["url_route"]["kwargs"].get("room_name")
        if not self.room_name:
            await self.close(code=4002)
            return

        # ✅ SECURITY: room_name باید یه آیدی کاربر معتبر باشه، نه هر چیز دلخواه
        try:
            self.other_user_id = int(self.room_name)
        except (TypeError, ValueError):
            await self.close(code=4003)
            return

        other_user_exists = await self.user_exists(self.other_user_id)
        if not other_user_exists:
            await self.close(code=4004)
            return

        self.room_group_name = f"chat_{'_'.join(sorted([str(self.user_id), str(self.room_name)]))}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        print(f"✅ WS connected: {self.channel_name} | user_id={self.user_id} | room={self.room_group_name}")

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
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"🔌 WS disconnected: {getattr(self, 'channel_name', '?')} | user_id={getattr(self, 'user_id', '?')}")

    # -------------------- روتر پیام‌های ورودی --------------------
    async def receive(self, text_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            await self.send_error("داده‌ی نامعتبر ارسال شد")
            return

        msg_type = data.get("type")
        msg = data.get("message")

        try:
            if msg_type == "chat_message":
                await self.handle_chat_message(msg or {})
            elif msg_type == "edit_message":
                await self.handle_edit_message(data)
            elif msg_type == "delete_message":
                await self.handle_delete_message(data)
            elif msg_type == "pin_message":
                await self.handle_pin_message(data)
            elif msg_type == "vote_poll":
                await self.handle_vote_poll(data)
            elif msg_type == "mark_read":
                await self.handle_mark_read(data)
            else:
                await self.send_error("Invalid message type")
        except Exception as e:
            print("❌ WS receive error:", e)
            await self.send_error(str(e))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({"type": "error", "error": message}))

    # -------------------- ارسال پیام جدید --------------------
    async def handle_chat_message(self, msg):
        # ✅ SECURITY: sender_id همیشه از کاربر احراز هویت‌شده گرفته می‌شه، نه از payload کلاینت
        sender_id = self.user_id
        receiver_id = msg.get("receiverId")
        temp_id = msg.get("tempId")
        text = msg.get("text", "")
        image_base64 = msg.get("image")
        file_base64 = msg.get("file")
        file_name = msg.get("fileName")
        message_type = msg.get("messageType", "text")
        meta = msg.get("meta")
        reply_to = msg.get("replyTo")

        if not receiver_id:
            await self.send_error("گیرنده مشخص نشده")
            return

        try:
            receiver_id = int(receiver_id)
        except (TypeError, ValueError):
            await self.send_error("گیرنده نامعتبر است")
            return

        if not text and not image_base64 and not file_base64 and not meta:
            await self.send_error("Empty message")
            return

        # ✅ NEW: چک بلاک قبل از ارسال پیام (هر دو طرف)
        if await self.is_blocked(sender_id, receiver_id):
            await self.send_error("امکان ارسال پیام وجود ندارد (یکی از طرفین بلاک کرده)")
            return

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

        if message_type == "poll" and meta and "options" in meta:
            meta = {
                "question": meta.get("question", ""),
                "multiple": bool(meta.get("multiple", False)),
                "options": [
                    {"id": opt.get("id") or str(uuid.uuid4()), "text": opt.get("text", ""), "voters": []}
                    for opt in meta["options"]
                ],
            }

        saved = await self.save_message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            image_file=image_file,
            doc_file=doc_file,
            file_name=file_name,
            message_type=message_type,
            meta=meta,
        )

        if saved is None:
            await self.send_error("گیرنده پیدا نشد")
            return

        message_data = {
            "id": saved.id,
            "tempId": temp_id,
            "text": saved.text,
            "senderId": sender_id,
            "receiverId": receiver_id,
            "image": saved.image.url if saved.image else None,
            "file": saved.file.url if saved.file else None,
            "fileName": saved.file_name,
            "messageType": saved.message_type,
            "meta": saved.meta,
            "isRead": saved.is_read,
            "replyTo": reply_to,
            "createdAt": str(saved.created_date),
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message_broadcast", "message": message_data}
        )
        print(f"✅ Message saved and broadcasted: {saved.id}")

        for uid in {sender_id, receiver_id}:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {"type": "new_message_notify", "message": message_data}
            )

    async def chat_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"]
        }))

    # -------------------- ویرایش پیام (فقط نویسنده) --------------------
    async def handle_edit_message(self, data):
        message_id = data.get("messageId")
        new_text = data.get("newText")
        if not message_id or new_text is None:
            return

        result = await self.edit_message(message_id, new_text, self.user_id)
        if result == "not_found":
            await self.send_error("پیام پیدا نشد")
            return
        if result == "forbidden":
            await self.send_error("فقط نویسنده‌ی پیام می‌تواند آن را ویرایش کند")
            return

        sender_id, receiver_id = result

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "edit_message_broadcast", "messageId": message_id, "newText": new_text}
        )
        print(f"✏️ Message edited: {message_id}")

        for uid in {sender_id, receiver_id}:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {"type": "message_edit_notify", "messageId": message_id, "newText": new_text}
            )

    async def edit_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "edit_message",
            "messageId": event["messageId"],
            "newText": event["newText"],
        }))

    # -------------------- حذف پیام (فقط نویسنده) --------------------
    async def handle_delete_message(self, data):
        message_id = data.get("messageId")
        if not message_id:
            return

        result = await self.delete_message(message_id, self.user_id)
        if result == "not_found":
            await self.send_error("پیام پیدا نشد")
            return
        if result == "forbidden":
            await self.send_error("فقط نویسنده‌ی پیام می‌تواند آن را حذف کند")
            return

        sender_id, receiver_id = result

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "delete_message_broadcast", "messageId": message_id}
        )
        print(f"🗑️ Message deleted: {message_id}")

        for uid in {sender_id, receiver_id}:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {"type": "message_delete_notify", "messageId": message_id}
            )

    async def delete_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "delete_message",
            "messageId": event["messageId"]
        }))

    # -------------------- پین/آن‌پین پیام (فقط real-time، ذخیره نمی‌شه) --------------------
    async def handle_pin_message(self, data):
        message_id = data.get("messageId")
        pinned = data.get("pinned", True)
        if not message_id:
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "pin_message_broadcast", "messageId": message_id, "pinned": pinned}
        )
        print(f"📌 Pin toggled: {message_id} -> {pinned}")

    async def pin_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "pin_message",
            "messageId": event["messageId"],
            "pinned": event["pinned"],
        }))

    # -------------------- رأی دادن به نظرسنجی --------------------
    async def handle_vote_poll(self, data):
        message_id = data.get("messageId")
        option_id = data.get("optionId")
        if not message_id or not option_id:
            return

        meta = await self.vote_poll(message_id, option_id, self.user_id)
        if meta is None:
            await self.send_error("نظرسنجی پیدا نشد")
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "poll_update_broadcast", "messageId": message_id, "meta": meta}
        )

    async def poll_update_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "poll_update",
            "messageId": event["messageId"],
            "meta": event["meta"],
        }))

    # -------------------- ✅ NEW: علامت‌گذاری پیام‌ها به‌عنوان خوانده‌شده (تیک آبی) --------------------
    async def handle_mark_read(self, data):
        message_ids = data.get("messageIds", [])
        if not message_ids:
            return

        reader_id = self.user_id
        updated_ids, sender_ids = await self.mark_messages_read(message_ids, reader_id)
        if not updated_ids:
            return

        for sender_id in sender_ids:
            await self.channel_layer.group_send(
                f"user_{sender_id}",
                {"type": "read_receipt_notify", "messageIds": updated_ids, "readerId": reader_id}
            )
        print(f"👁️ {len(updated_ids)} پیام توسط user_id={reader_id} خونده شد")

    # ======================================================================
    # DB helpers (همه async-safe، با sync_to_async / database_sync_to_async)
    # ======================================================================
    @database_sync_to_async
    def user_exists(self, user_id):
        return User.objects.filter(id=user_id).exists()

    @database_sync_to_async
    def is_blocked(self, user_a, user_b):
        return BlockModels.objects.filter(
            Q(user_id=user_a, blocked_user_id=user_b) |
            Q(user_id=user_b, blocked_user_id=user_a)
        ).exists()

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, text, image_file, doc_file, file_name, message_type, meta):
        if not User.objects.filter(id=receiver_id).exists():
            return None
        return MessageModels.objects.create(
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            image=image_file,
            file=doc_file,
            file_name=file_name if doc_file else None,
            message_type=message_type,
            meta=meta,
        )

    @database_sync_to_async
    def edit_message(self, message_id, new_text, requester_id):
        try:
            msg_obj = MessageModels.objects.get(id=message_id)
        except MessageModels.DoesNotExist:
            return "not_found"
        if msg_obj.sender_id != requester_id:
            return "forbidden"
        msg_obj.text = new_text
        msg_obj.save(update_fields=["text", "updated_date"])
        return msg_obj.sender_id, msg_obj.receiver_id

    @database_sync_to_async
    def delete_message(self, message_id, requester_id):
        try:
            msg_obj = MessageModels.objects.get(id=message_id)
        except MessageModels.DoesNotExist:
            return "not_found"
        if msg_obj.sender_id != requester_id:
            return "forbidden"
        sender_id, receiver_id = msg_obj.sender_id, msg_obj.receiver_id
        msg_obj.delete()
        return sender_id, receiver_id

    @database_sync_to_async
    def vote_poll(self, message_id, option_id, uid):
        try:
            msg_obj = MessageModels.objects.get(id=message_id, message_type="poll")
        except MessageModels.DoesNotExist:
            return None

        meta = msg_obj.meta or {}
        options = meta.get("options", [])
        multiple = meta.get("multiple", False)

        target_option = next((o for o in options if o.get("id") == option_id), None)
        if not target_option:
            return None

        already_voted = uid in target_option.get("voters", [])

        if not multiple:
            for o in options:
                if uid in o.get("voters", []):
                    o["voters"].remove(uid)

        if already_voted:
            if uid in target_option["voters"]:
                target_option["voters"].remove(uid)
        else:
            target_option.setdefault("voters", []).append(uid)

        meta["options"] = options
        msg_obj.meta = meta
        msg_obj.save(update_fields=["meta", "updated_date"])
        return meta

    @database_sync_to_async
    def mark_messages_read(self, message_ids, reader_id):
        # ✅ SECURITY: فقط پیام‌هایی که واقعاً receiver‌شون خودِ کاربره علامت می‌خورن
        qs = MessageModels.objects.filter(id__in=message_ids, receiver_id=reader_id, is_read=False)
        sender_ids = list(qs.values_list("sender_id", flat=True).distinct())
        updated_ids = list(qs.values_list("id", flat=True))
        qs.update(is_read=True, read_at=now())
        return updated_ids, sender_ids
# ======================================================================================================================
class OnlineStatusConsumer(AsyncWebsocketConsumer):

    online_users = {}

    async def connect(self):
        user = self.scope["user"]

        if user.is_anonymous:
            await self.close(code=4001)
            return

        self.user = user
        self.user_id = user.id
        self.group_name = f"user_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        self.online_users[self.user_id] = self.online_users.get(self.user_id, 0) + 1

        contacts = await self.get_contacts()
        await self.send(text_data=json.dumps({"type": "contacts_list", "contacts": contacts}))

        if self.online_users[self.user_id] == 1:
            await self.broadcast_presence(True)

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if not hasattr(self, "user_id") or self.user_id not in self.online_users:
            return

        self.online_users[self.user_id] -= 1

        if self.online_users[self.user_id] <= 0:
            del self.online_users[self.user_id]
            await self.broadcast_presence(False)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        if data.get("type") == "get_contacts":
            contacts = await self.get_contacts()
            await self.send(text_data=json.dumps({"type": "contacts_list", "contacts": contacts}))

    # -------------------- broadcast handlers --------------------
    async def presence_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence_update",
            "userId": event["userId"],
            "online": event["online"],
        }))

    async def new_message_notify(self, event):
        await self.send(text_data=json.dumps({"type": "new_message_notify", "message": event["message"]}))

    async def message_edit_notify(self, event):
        await self.send(text_data=json.dumps({
            "type": "message_edit_notify",
            "messageId": event["messageId"],
            "newText": event["newText"],
        }))

    async def message_delete_notify(self, event):
        await self.send(text_data=json.dumps({
            "type": "message_delete_notify",
            "messageId": event["messageId"],
        }))

    # ✅ NEW: اطلاع به فرستنده که پیامش خونده شد (برای تیک آبی)
    async def read_receipt_notify(self, event):
        await self.send(text_data=json.dumps({
            "type": "read_receipt",
            "messageIds": event["messageIds"],
            "readerId": event["readerId"],
        }))

    # -------------------- DB helpers --------------------
    @database_sync_to_async
    def get_contacts(self):
        contacts = ContactModels.objects.filter(user=self.user).select_related("contact", "contact__user_profile")
        blocked_ids = set(
            BlockModels.objects.filter(user=self.user).values_list("blocked_user_id", flat=True)
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
                "is_blocked": item.contact.id in blocked_ids,
            })
        return result

    @database_sync_to_async
    def get_watchers(self):
        return list(ContactModels.objects.filter(contact_id=self.user_id).values_list("user_id", flat=True))

    async def broadcast_presence(self, online):
        users = await self.get_watchers()
        for uid in users:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {"type": "presence_update", "userId": self.user_id, "online": online},
            )
# ======================================================================================================================