import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useSettingsStore } from "../store/useSettingsStore";

const API_BASE_URL = "http://localhost:8000";

export default function useDesktopNotifications() {
    const settingsRef = useRef(useSettingsStore.getState());

    // همیشه آخرین مقدار تنظیمات را نگه می‌داریم
    useEffect(() => {
        return useSettingsStore.subscribe((state) => {
            settingsRef.current = state;
        });
    }, []);

    // ✅ FIX: درخواست مجوز نوتیفیکیشن فقط یک بار — پرامیسش رو هم هندل می‌کنیم
    useEffect(() => {
        if (typeof Notification === "undefined") return;

        if (Notification.permission === "default") {
            Notification.requestPermission().catch((err) => {
                console.warn("❌ خطا در درخواست مجوز نوتیفیکیشن:", err);
            });
        }
    }, []);

    // دریافت پیام جدید و ساخت Notification
    useEffect(() => {
        if (typeof Notification === "undefined") return;

        console.debug("🔔 [notif] listener registered, waiting for new_message_notify...");

        return useChatStore.getState().addMessageEventListener((data) => {
            console.debug("🔔 [notif] event received:", data.type, data);

            if (data.type !== "new_message_notify") return;

            const { authUser } = useAuthStore.getState();
            const msg = data.message;
            if (!msg) {
                console.debug("🔔 [notif] blocked: no msg payload");
                return;
            }

            // =====================================================
            // بررسی فرستنده — پیام از خودمون نباشه
            // =====================================================
            const senderId = msg.senderId ?? msg.sender;
            if (senderId && authUser?.id && String(senderId) === String(authUser.id)) {
                console.debug("🔔 [notif] blocked: message is from myself");
                return;
            }

            // =====================================================
            // ✅ FIX: بک‌اند فیلدهای chatType/chatName/senderImage/chatId
            // رو اصلاً نمی‌فرسته — پیام‌های خصوصی همیشه از همین سوکت
            // میان (پیام گروه/چنل مسیر جدایی داره)، پس همیشه private
            // فرض می‌کنیم و اسم/عکس فرستنده رو از لیست مخاطبین درمیاریم.
            // =====================================================
            const chatType = "private";

            if (chatType === "group" || chatType === "channel") {
                if (!settingsRef.current.notifGroups) {
                    console.debug("🔔 [notif] blocked: notifGroups is off in settings");
                    return;
                }
            } else {
                if (!settingsRef.current.notifMessages) {
                    console.debug("🔔 [notif] blocked: notifMessages is off in settings", settingsRef.current);
                    return;
                }
            }

            if (Notification.permission !== "granted") {
                console.debug("🔔 [notif] blocked: permission is", Notification.permission);
                return;
            }

            // اگر کاربر داخل خودِ تب فعاله، نوتیف نساز
            if (document.visibilityState === "visible") {
                console.debug("🔔 [notif] blocked: tab is visible (document.visibilityState === 'visible')");
                return;
            }

            // =====================================================
            // ✅ FIX: پیدا کردن اسم و عکس فرستنده از لیست مخاطبین
            // (چون خودِ پیام این اطلاعات رو نداره)
            // =====================================================
            const { allContacts } = useChatStore.getState();
            const senderContact = allContacts.find(
                (c) => String(c._id || c.id) === String(senderId)
            );
            const senderName = senderContact?.name || "پیام جدید";

            const rawImage = senderContact?.profile || senderContact?.raw?.profile;
            const icon = rawImage
                ? rawImage.startsWith("http")
                    ? rawImage
                    : `${API_BASE_URL}${rawImage}`
                : "/avatar.png";

            const title = senderName;

            const body = settingsRef.current.notifPreview
                ? msg.text || (msg.image ? "📷 عکس" : msg.file ? "📎 فایل" : "پیام جدید")
                : "پیام جدید دریافت شد";

            try {
                console.debug("🔔 [notif] creating notification:", title, body);
                const notif = new Notification(title, {
                    body,
                    icon,
                    silent: !settingsRef.current.notifVibrate,
                    tag: `chatify-private-${senderId || "msg"}`,
                });

                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };

                if (settingsRef.current.notifVibrate && navigator.vibrate) {
                    navigator.vibrate(200);
                }
            } catch (err) {
                console.warn("❌ Notification error:", err);
            }
        });
    }, []);
}