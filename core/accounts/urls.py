from rest_framework_simplejwt.views import TokenObtainPairView
from django.urls import path
from .views import (
    RegisterViews,
    RequestPasswordResetEmail,
    PasswordResetConfirmView,
    ActivateAccount,
    LogoutView,
    CustomTokenObtainPairView
)

urlpatterns = [
    path("register/", RegisterViews.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),

    path(
        "password-reset/",
        RequestPasswordResetEmail.as_view(),
        name="request-reset-email",
    ),
    path(
        "password-reset-confirm/<uidb64>/<token>/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("activate-account/", ActivateAccount.as_view(), name="activate-account"),
]