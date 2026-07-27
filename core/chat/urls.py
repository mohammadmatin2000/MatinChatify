from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ContactViewSet, ChatViewSet, MessageViewSet, SearchUsersView
# ======================================================================================================================
router = DefaultRouter()
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages/(?P<receiver>\d+)', MessageViewSet, basename='message')
# ======================================================================================================================
urlpatterns = router.urls + [
    path('search-users/', SearchUsersView.as_view(), name='search-users'),
]
# ======================================================================================================================