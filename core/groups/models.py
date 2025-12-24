from django.db import models
from accounts.models import User,Profile
# ======================================================================================================================
class Group(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_groups")
    description = models.TextField()
    is_active = models.BooleanField(default=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    def __str__(self):
        return self.name
# ======================================================================================================================
class GroupMember(models.Model):
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("member", "Member"),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="group_memberships")
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=255, choices=ROLE_CHOICES,default="member")
    joined_date = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ("user", "group")
    def __str__(self):
        return f"{self.user.username} - {self.group.name} ({self.role})"
# ======================================================================================================================
class GroupMessages(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="group_messages")
    text = models.TextField()
    is_edited= models.BooleanField(default=False)
    is_deleted= models.BooleanField(default=False)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    def __str__(self):
        return f"{self.author.username} در {self.group.name}: {self.text[:30]}"
# ======================================================================================================================
class GroupAttachment(models.Model):
    message = models.ForeignKey(
        GroupMessages, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="group_files/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for message {self.message.id} in {self.message.group.name}"
# ======================================================================================================================
class GroupInvite(models.Model):
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="invites"
    )
    code = models.CharField(max_length=10, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(auto_now_add=True)
    expires_date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Invite {self.code} for {self.group.name}"
# ======================================================================================================================