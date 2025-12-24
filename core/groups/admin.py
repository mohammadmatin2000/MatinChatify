from django.contrib import admin
from .models import Group, GroupMember, GroupMessages, GroupAttachment, GroupInvite

# ======================================================================================================================
class GroupMemberInline(admin.TabularInline):
    model = GroupMember
    extra = 1
    autocomplete_fields = ['user']

# ======================================================================================================================
class MessageInline(admin.TabularInline):
    model = GroupMessages
    extra = 0
    readonly_fields = ('author', 'text', 'created_date', 'updated_date', 'is_edited', 'is_deleted')
    can_delete = True
    show_change_link = True

# ======================================================================================================================
class GroupAttachmentInline(admin.TabularInline):
    model = GroupAttachment
    extra = 0
    readonly_fields = ('uploaded_at',)

# ======================================================================================================================
class GroupInviteInline(admin.TabularInline):
    model = GroupInvite
    extra = 0
    readonly_fields = ('code', 'created_by', 'created_date', 'expires_date')

# ======================================================================================================================
@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'is_active', 'created_date', 'updated_date')
    search_fields = ('name', 'owner__username')
    list_filter = ('is_active', 'created_date', 'updated_date')
    inlines = [GroupMemberInline, MessageInline, GroupInviteInline]

# ======================================================================================================================
@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'group', 'role', 'joined_date')
    list_filter = ('role', 'group')
    search_fields = ('user__username', 'group__name')

# ======================================================================================================================
@admin.register(GroupMessages)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('author', 'group', 'text', 'is_edited', 'is_deleted', 'created_date')
    search_fields = ('author__username', 'text')
    list_filter = ('group', 'created_date')
    inlines = [GroupAttachmentInline]

# ======================================================================================================================
@admin.register(GroupAttachment)
class GroupAttachmentAdmin(admin.ModelAdmin):
    list_display = ('message', 'file', 'uploaded_at')
    search_fields = ('message__text',)
    list_filter = ('uploaded_at',)

# ======================================================================================================================
@admin.register(GroupInvite)
class GroupInviteAdmin(admin.ModelAdmin):
    list_display = ('code', 'group', 'created_by', 'created_date', 'expires_date')
    search_fields = ('code', 'group__name', 'created_by__username')
    list_filter = ('created_date', 'expires_date')
# ======================================================================================================================