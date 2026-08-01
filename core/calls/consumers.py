import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from groups.models import GroupMember
# ======================================================================================================================
# مدیریت سیگنالینگ تماس صوتی/تصویری (WebRTC) - فقط پیام‌ها رو رله می‌کنه، خود صدا/تصویر از اینجا رد نمی‌شه
class CallSignalingConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        self.user_id = self.user.id if self.user.is_authenticated else None

        if not self.user_id:
            await self.close()
            return

        # هر کاربر یه گروه شخصی داره تا بشه مستقیم پیام رو براش فرستاد
        self.group_name = f"call_{self.user_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        print(f"📞 اتصال سیگنالینگ تماس برقرار شد: user_id={self.user_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"📞 اتصال سیگنالینگ تماس قطع شد: user_id={self.user_id}")

    async def receive(self, text_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError) as e:
            print("❌ داده‌ی نامعتبر در سیگنالینگ تماس:", e)
            return

        target_id = data.get("targetId")
        # اگه targetGroupId باشه (به‌جای targetId)، یعنی این سیگنال
        # مخصوص تماس گروهیه و باید به همه‌ی اعضای اون گروه (به‌جز خود فرستنده) برسه.
        target_group_id = data.get("targetGroupId")

        payload = {**data, "fromId": self.user_id}

        try:
            if target_id:
                # رله‌ی مستقیم به یک کاربر خاص (تماس ۱ به ۱، یا
                # legهای peer-to-peer داخل یه تماس گروهی)
                await self.channel_layer.group_send(
                    f"call_{target_id}",
                    {"type": "call_signal_relay", "payload": payload},
                )
                return

            if target_group_id:
                member_ids = await self.get_group_member_ids(target_group_id)
                for uid in member_ids:
                    if uid == self.user_id:
                        continue
                    await self.channel_layer.group_send(
                        f"call_{uid}",
                        {"type": "call_signal_relay", "payload": payload},
                    )
        except Exception as e:
            print("❌ خطا در سیگنالینگ تماس:", e)

    # این متد وقتی صدا زده می‌شه که یه پیام از یه کاربر دیگه به این کاربر رله شده
    async def call_signal_relay(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    @database_sync_to_async
    def get_group_member_ids(self, group_id):
        return list(GroupMember.objects.filter(group_id=group_id).values_list("user_id", flat=True))
# ======================================================================================================================