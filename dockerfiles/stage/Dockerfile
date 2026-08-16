FROM python:3.13-slim

# جلوگیری از ساخت فایل‌های pyc
ENV PYTHONDONTWRITEBYTECODE=1

# نمایش مستقیم لاگ‌های Python
ENV PYTHONUNBUFFERED=1

# مسیر پروژه
WORKDIR /usr/src/app

# نصب وابستگی‌های سیستمی
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# کپی requirements
COPY requirements.txt /usr/src/app/requirements.txt

# نصب پکیج‌های Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ساخت پوشه‌های مورد نیاز Django
RUN mkdir -p /usr/src/app/staticfiles \
    /usr/src/app/media

# کپی پروژه
COPY ./core /usr/src/app

# پورت داخلی Django / Daphne
EXPOSE 8000

# اجرای Django Channels با Daphne
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]