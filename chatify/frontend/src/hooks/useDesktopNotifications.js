import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { API_URL } from "../lib/apiConfig";
const API_BASE_URL = API_URL;

export default function useDesktopNotifications() {
    const settingsRef = useRef(useSettingsStore.getState());

    useEffect(() => {
        return useSettingsStore.subscribe((state) => {
            settingsRef.current = state;
        });
    }, []);

    useEffect(() => {
        if (typeof Notification === "undefined") return;

        if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => {
                // اگه کاربر اجازه نده یا مرورگر ساپورت نکنه، بی‌سروصدا نادیده می‌گیریم
            });
        }
    }, []);

    useEffect(() => {
        if (typeof Notification === "undefined") return;

        return useChatStore.getState().addMessageEventListener((data) => {
            if (data.type !== "new_message_notify") return;

            const { authUser } = useAuthStore.getState();
            const msg = data.message;
            if (!msg) return;

            const senderId = msg.senderId ?? msg.sender;
            if (senderId && authUser?.id && String(senderId) === String(authUser.id)) return;

            const chatType = "private";

            if (chatType === "group" || chatType === "channel") {
                if (!settingsRef.current.notifGroups) return;
            } else {
                if (!settingsRef.current.notifMessages) return;
            }

            if (Notification.permission !== "granted") return;

            if (document.visibilityState === "visible") return;

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
            } catch {
                // ساخت نوتیفیکیشن ممکنه به هر دلیلی شکست بخوره (مثلاً مرورگر بلاکش کنه)؛
                // بی‌سروصدا نادیده می‌گیریم تا کل جریان پیام‌رسانی رو مختل نکنه
            }
        });
    }, []);
}