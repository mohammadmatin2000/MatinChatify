from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    ContactViewSet, ChatViewSet, MessageViewSet, SearchUsersView,
    BlockViewSet, UnblockByUserView, BlockStatusView, ReportUserView,
)
# ======================================================================================================================
router = DefaultRouter()
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages/(?P<receiver>\d+)', MessageViewSet, basename='message')
router.register(r'blocks', BlockViewSet, basename='block')
# ======================================================================================================================
urlpatterns = router.urls + [
    path('search-users/', SearchUsersView.as_view(), name='search-users'),
    path('blocks/unblock/<int:user_id>/', UnblockByUserView.as_view(), name='unblock-user'),
    path('blocks/status/<int:user_id>/', BlockStatusView.as_view(), name='block-status'),
    path('report/', ReportUserView.as_view(), name='report-user'),
]
# ======================================================================================================================