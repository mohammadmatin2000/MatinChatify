import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Group, GroupMessages, GroupMember
User = get_user_model()
# ======================================================================================================================
class GroupConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.group_name = f"group_{self.group_id}"
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # بررسی اینکه کاربر عضو گروه هست
        if not await self.is_member(self.user.id, self.group_id):
            await self.close()
            return

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()


        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_event",
                "event": "joined",
                "username": self.user.username,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )


        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_event",
                "event": "left",
                "username": self.user.username,
            }
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action", "message")

        if action == "message":
            text = data.get("text", "")
            if text.strip() == "":
                return


            message = await self.save_message(self.user, self.group_id, text)


            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "author": self.user.username,
                    "text": message.text,
                    "message_id": message.id,
                    "created_at": str(message.created_date),
                }
            )

        elif action == "delete_message":
            message_id = data.get("message_id")
            await self.delete_message(message_id)

        elif action == "delete_group":
            await self.delete_group(self.group_id)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "author": event["author"],
            "text": event["text"],
            "message_id": event["message_id"],
            "created_at": event["created_at"],
        }))

    async def user_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "user_event",
            "event": event["event"],
            "username": event["username"],
        }))


    @database_sync_to_async
    def is_member(self, user_id, group_id):
        return GroupMember.objects.filter(user_id=user_id, group_id=group_id).exists()

    @database_sync_to_async
    def save_message(self, user, group_id, text):
        group = Group.objects.get(id=group_id)
        return GroupMessages.objects.create(group=group, author=user, text=text)

    @database_sync_to_async
    def delete_message(self, message_id):
        try:
            msg = GroupMessages.objects.get(id=message_id)
            msg.delete()
        except GroupMessages.DoesNotExist:
            pass

    @database_sync_to_async
    def delete_group(self, group_id):
        try:
            group = Group.objects.get(id=group_id)
            group.delete()
        except Group.DoesNotExist:
            pass
# ======================================================================================================================