from django.urls import path,include
from .views import GroupViewSet, GroupMemberViewSet, GroupMessageViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='groups')
router.register(r'members', GroupMemberViewSet, basename='members')

urlpatterns = [
    path('', include(router.urls)),

    # مسیر پیام‌های گروه
    path('groups/<int:group_id>/messages/', GroupMessageViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='group-messages'),
]
