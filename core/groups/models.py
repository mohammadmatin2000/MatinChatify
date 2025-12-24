from django.db import models
from accounts.models import User,Profile
# ======================================================================================================================
class GroupModels(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="groups")
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
    group = models.ForeignKey(GroupModels, on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=255, choices=ROLE_CHOICES,default="member")
    class Meta:
        unique_together = ("user", "group")
    def __str__(self):
        return f"{self.user} - {self.group}"
# ======================================================================================================================
