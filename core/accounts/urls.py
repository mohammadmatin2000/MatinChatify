# -*- coding: utf-8 -*-

from django.urls import path

# ویو آماده‌ی simplejwt برای گرفتن access token جدید با استفاده از refresh token
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterViews,
    RequestPasswordResetEmail,
    PasswordResetConfirmView,
    ActivateAccount,
    LogoutView,
    CustomTokenObtainPairView,
    UserProfileUpdateView,
    RequestPhoneOTPView,
    VerifyPhoneOTPView,
    Verify2FAView,
)

# ======================================================================================================================
urlpatterns = [
    # --- احراز هویت پایه (ثبت‌نام / ورود / خروج / رفرش توکن) ---
    path("register/", RegisterViews.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # --- فراموشی و بازیابی رمز عبور ---
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

    # --- فعال‌سازی حساب کاربری از طریق ایمیل ---
    path("activate-account/", ActivateAccount.as_view(), name="activate-account"),

    # --- مدیریت پروفایل کاربر ---
    path("profile/update/", UserProfileUpdateView.as_view(), name="profile-update"),

    # --- ورود/ثبت‌نام با شماره تلفن از طریق کد یک‌بارمصرف (OTP) ---
    path("otp/request/", RequestPhoneOTPView.as_view(), name="otp-request"),
    path("otp/verify/", VerifyPhoneOTPView.as_view(), name="otp-verify"),

    # --- احراز هویت دومرحله‌ای (2FA) ---
    path("verify-2fa/", Verify2FAView.as_view(), name="verify-2fa"),
]
# ======================================================================================================================