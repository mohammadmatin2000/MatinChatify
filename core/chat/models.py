from django.db import models
from accounts.models import User
# ======================================================================================================================
class ContactModels(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacts")
    contact = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacted_by")
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - {self.contact}"
# ======================================================================================================================
class ChatModels(models.Model):
    participants = models.ManyToManyField(User, related_name="chats")
    last_message = models.ForeignKey("MessageModels", on_delete=models.SET_NULL, null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat between {', '.join([u.email for u in self.participants.all()])}"
# ======================================================================================================================
class MessageModels(models.Model):
    chat = models.ForeignKey(ChatModels, on_delete=models.CASCADE, related_name="messages")  # بدون null=True
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")
    text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to="messages/", null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.chat:
            self.chat.last_message = self
            self.chat.save()

    def __str__(self):
        return f"{self.sender.email} → {self.receiver.email}"
# ======================================================================================================================