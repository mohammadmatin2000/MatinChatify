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

    // درخواست مجوز نوتیفیکیشن فقط یک بار
    useEffect(() => {
        if (typeof Notification === "undefined") return;

        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    // دریافت پیام جدید و ساخت Notification
    useEffect(() => {
        if (typeof Notification === "undefined") return;

        const unsubscribe =
            useChatStore.getState().addMessageEventListener((data) => {
                console.log("🔔 notif event received:", data);

                if (data.type !== "new_message_notify") return;

                const { authUser } = useAuthStore.getState();
                const msg = data.message;

                if (!msg) return;

                // =====================================================
                // بررسی فرستنده
                // =====================================================

                const senderId = msg.senderId ?? msg.sender;

                console.log(
                    "👤 senderId:",
                    senderId,
                    "| authUser.id:",
                    authUser?.id
                );

                // پیام از خودمون نباشه
                if (
                    senderId &&
                    authUser?.id &&
                    String(senderId) === String(authUser.id)
                ) {
                    console.log("⛔ رد شد: پیام از خودمونه");
                    return;
                }

                // =====================================================
                // تنظیمات Notification
                // =====================================================

                const settings = settingsRef.current;

                const chatType = msg.chatType || "private";

                console.log(
                    "⚙️ settings:",
                    settings,
                    "| chatType:",
                    chatType
                );

                // =====================================================
                // بررسی فعال بودن Notification برای نوع چت
                // =====================================================

                if (chatType === "group" || chatType === "channel") {
                    if (!settings.notifGroups) {
                        console.log(
                            "⛔ رد شد: notifGroups خاموشه"
                        );
                        return;
                    }
                } else {
                    if (!settings.notifMessages) {
                        console.log(
                            "⛔ رد شد: notifMessages خاموشه"
                        );
                        return;
                    }
                }

                // =====================================================
                // بررسی Permission
                // =====================================================

                if (Notification.permission !== "granted") {
                    console.log(
                        "⛔ رد شد: permission نداریم"
                    );
                    return;
                }

                // =====================================================
                // اگر کاربر داخل سایت است Notification نساز
                // =====================================================

                if (document.visibilityState === "visible") {
                    console.log(
                        "⛔ رد شد: تب visible هست"
                    );
                    return;
                }

                console.log(
                    "✅ نوتیف باید ساخته بشه!"
                );

                // =====================================================
                // عنوان Notification
                // =====================================================

                const title =
                    chatType === "group" ||
                    chatType === "channel"
                        ? msg.chatName || "پیام جدید"
                        : msg.senderName || "پیام جدید";

                // =====================================================
                // متن Notification
                // =====================================================

                const body = settings.notifPreview
                    ? msg.text ||
                      (msg.image
                          ? "📷 عکس"
                          : msg.file
                              ? "📎 فایل"
                              : "پیام جدید")
                    : "پیام جدید دریافت شد";

                // =====================================================
                // Avatar
                // =====================================================

                const icon = msg.senderImage
                    ? msg.senderImage.startsWith("http")
                        ? msg.senderImage
                        : `${API_BASE_URL}${msg.senderImage}`
                    : "/avatar.png";

                console.log("🔔 Notification data:", {
                    title,
                    body,
                    icon,
                    chatType,
                });

                // =====================================================
                // ساخت Notification
                // =====================================================

                try {
                    const notif = new Notification(title, {
                        body,
                        icon,
                        silent: !settings.notifVibrate,
                        tag: `chatify-${chatType}-${
                            msg.chatId || senderId || "msg"
                        }`,
                    });

                    console.log(
                        "🎉 Notification ساخته شد"
                    );

                    // کلیک روی Notification
                    notif.onclick = () => {
                        window.focus();
                        notif.close();
                    };

                    // =================================================
                    // ویبره موبایل
                    // =================================================

                    if (
                        settings.notifVibrate &&
                        navigator.vibrate
                    ) {
                        navigator.vibrate(200);

                        console.log(
                            "📳 Vibration اجرا شد"
                        );
                    }
                } catch (err) {
                    console.warn(
                        "❌ Notification error:",
                        err
                    );
                }
            });

        // Cleanup
        return unsubscribe;
    }, []);
}