"""
ارسال پیامک کد تایید (OTP) — به کاوه‌نگار وصله.

نصب پکیج لازم:
    pip install kavenegar
"""
import logging
from django.conf import settings
# ======================================================================================================================
logger = logging.getLogger(__name__)

# ✅ اگه هنوز اکانت کاوه‌نگارت رو کامل ست‌آپ نکردی، این رو True نگه‌دار
# تا کد توی کنسول چاپ بشه (نه پیامک واقعی). وقتی مطمئن شدی، این رو
# False کن.
SMS_DEV_MODE = getattr(settings, "SMS_DEV_MODE", True)


def send_otp_sms(phone_number: str, code: str) -> bool:
    """
    کد تایید رو به phone_number می‌فرسته. True/False برمی‌گردونه که ارسال
    موفق بوده یا نه.
    """
    if SMS_DEV_MODE:
        print(f"\n📱 [DEV SMS] کد تایید برای {phone_number}: {code}\n")
        logger.info("DEV OTP for %s: %s", phone_number, code)
        return True

    from kavenegar import KavenegarAPI, APIException, HTTPException

    api_key = getattr(settings, "KAVENEGAR_API_KEY", None)

    if not api_key:
        logger.error("KAVENEGAR_API_KEY توی settings ست نشده")
        return False

    try:
        api = KavenegarAPI(api_key)
        params = {
            "receptor": phone_number,
            "message": f"کد تایید شما: {code}",
            # sender رو خالی بذار تا از خط پیش‌فرض اکانتت استفاده بشه
        }
        api.sms_send(params)
        return True
    except (APIException, HTTPException) as e:
        logger.error("خطای ارسال پیامک کاوه‌نگار: %s", e)
        return False
# ======================================================================================================================