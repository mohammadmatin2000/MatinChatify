# -*- coding: utf-8 -*-
"""
ارسال پیامک کد تایید (OTP) — به کاوه‌نگار وصله.

نصب پکیج لازم:
    pip install kavenegar
"""

import logging
from django.conf import settings

# ======================================================================================================================
logger = logging.getLogger(__name__)

# اگه هنوز اکانت کاوه‌نگارت رو کامل ست‌آپ نکردی، این رو True نگه‌دار
# تا کد به‌جای پیامک واقعی، فقط توی لاگ ثبت بشه. وقتی مطمئن شدی، این رو
# False کن (از طریق تنظیمات settings.py پروژه).
SMS_DEV_MODE = getattr(settings, "SMS_DEV_MODE", True)


def send_otp_sms(phone_number: str, code: str) -> bool:
    """
    کد تایید رو به phone_number می‌فرسته.
    خروجی: True در صورت ارسال موفق، False در صورت شکست.
    """
    # حالت توسعه (Dev Mode): پیامک واقعی ارسال نمی‌شه، فقط توی لاگ سرور ثبت می‌شه
    # تا در محیط توسعه بدون نیاز به اعتبار کاوه‌نگار هم بشه تست کرد
    if SMS_DEV_MODE:
        logger.info("کد تایید (حالت توسعه) برای %s: %s", phone_number, code)
        return True

    # ایمپورت داخل تابع تا در حالت DEV_MODE نیازی به نصب پکیج kavenegar نباشه
    from kavenegar import KavenegarAPI, APIException, HTTPException

    api_key = getattr(settings, "KAVENEGAR_API_KEY", None)

    if not api_key:
        logger.error("KAVENEGAR_API_KEY توی settings ست نشده است.")
        return False

    try:
        api = KavenegarAPI(api_key)
        params = {
            "receptor": phone_number,
            "message": f"کد تایید شما: {code}",
            # sender رو خالی می‌ذاریم تا از خط پیش‌فرض اکانت کاوه‌نگار استفاده بشه
        }
        api.sms_send(params)
        return True
    except (APIException, HTTPException) as e:
        logger.error("خطای ارسال پیامک کاوه‌نگار برای %s: %s", phone_number, e)
        return False
# ======================================================================================================================