import os
from pathlib import Path
from decouple import config
from datetime import timedelta  # اضافه کردن این خط برای import کردن timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-rypu+!750p%+bjdjsoh5t=@4m!fm-v8gt%(#q%-10s)ghx)pq0')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = ["*"]

# Application definition
INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework_simplejwt.token_blacklist",
    "rest_framework",
    "drf_yasg",
    "corsheaders",
    "channels",

    "accounts",
    "chat",
    "calls",
    "groups",
    "chchannels",
    "settings",

]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # مدیریت CORS
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = 'core.asgi.application'

# settings.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [{
                "address": "redis://redis:6379/0",
                "socket_connect_timeout": 5,
                "socket_timeout": 15,
                "socket_keepalive": True,
                "retry_on_timeout": True,
            }],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",  # موتور PostgreSQL
        "NAME": config("PG_NAME", default="default_database"),  # نام دیتابیس
        "USER": config("PG_USER", default="username"),  # نام کاربری
        "PASSWORD": config("PG_PASSWORD", default="password"),  # پسورد
        "HOST": config("PG_HOST", default="db"),  # هاست دیتابیس
        "PORT": config("PG_PORT", cast=int, default=5432),  # پورت
    }
}

# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"
STATICFILES_DIRS = [BASE_DIR / "static"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# تنظیمات CORS
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

AUTH_USER_MODEL = "accounts.User"

# REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,  # اگر از چرخش توکن‌ها استفاده می‌کنید
    'BLACKLIST_AFTER_ROTATION': True,  # بلاک کردن توکن پس از چرخش
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}


SMS_DEV_MODE = False  # فعلاً True بذار تا وقتی الگو رو بسازی، بعد False کن
KAVENEGAR_API_KEY = os.environ.get("KAVENEGAR_API_KEY", "676F7A35742F30464E494F634E334545674E336853656B547878747A552F427139795872396869364B636B3D")
KAVENEGAR_VERIFY_TEMPLATE = "verify"  # اسم دقیق الگویی که توی پنل کاوه‌نگار ساختی


VAPID_PUBLIC_KEY = "BOUMUrLB-jCynv5GyBWGwFa5BK8pzotKc7-KUWv2F3O_t5AsVKh6QQtVHjKsA4rrQ-rwYt3QEwByZ4hpIN38FGQ"
VAPID_PRIVATE_KEY = "a1ioTlwvvX--dREE4-TjIKAD6KA1biJzkdzbz7hTTpE"
VAPID_ADMIN_EMAIL = "matin20001313@gmail.com"


EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "mohammadmatin13872008@gmail.com"
EMAIL_HOST_PASSWORD = "yuzs vfwr zfbq ngho"
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER