from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GroupViewSet, GroupMemberViewSet, GroupMessageViewSet
# ======================================================================================================================
router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='groups')
router.register(r'members', GroupMemberViewSet, basename='members')
router.register(r'messages', GroupMessageViewSet, basename='messages')
# ======================================================================================================================
urlpatterns = [
    path('', include(router.urls)),
]
# ======================================================================================================================