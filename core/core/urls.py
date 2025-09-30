from django.contrib import admin  # پنل مدیریت
from django.urls import path, include  # مدیریت مسیرها
from rest_framework import permissions  # سطح دسترسی برای مستندات API
from drf_yasg.views import get_schema_view  # ساخت Swagger UI
from drf_yasg import openapi  # اطلاعات API برای مستندات
from django.conf.urls.static import static  # سرو فایل‌های استاتیک و مدیا
from django.conf import settings  # دسترسی به تنظیمات پروژه
# ======================================================================================================================
# تنظیمات Swagger / Redoc
schema_view = get_schema_view(
    openapi.Info(
        title="Weather API",  # عنوان مستندات
        default_version="v1",  # نسخه پیش‌فرض
        description="مستندات API هواشناسی",  # توضیح کوتاه
    ),
    public=True,  # مستندات عمومی باشد
    permission_classes=(permissions.AllowAny,),  # اجازه دسترسی همه
)

# ======================================================================================================================
urlpatterns = [
    path("admin/", admin.site.urls),  # پنل ادمین
    path("api-auth/", include("rest_framework.urls")),
    path("accounts/", include("accounts.urls")),


    # مسیر JSON مستندات Swagger
    path(
        "swagger.<format>/",
        schema_view.without_ui(cache_timeout=0),
        name="schema-json",
    ),
    # مسیر Swagger UI
    path(
        "swagger/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    # مسیر Redoc UI
    path(
        "redoc/",
        schema_view.with_ui("redoc", cache_timeout=0),
        name="schema-redoc",
    ),
]
# ======================================================================================================================
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
    )
    urlpatterns += static(
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
# ======================================================================================================================