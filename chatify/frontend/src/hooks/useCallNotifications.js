import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { useSettingsStore } from "../store/useSettingsStore";

// نوتیفیکیشن دسکتاپ برای تماس‌های ورودی — هم تماس خصوصی (۱به۱) و هم تماس
// گروهی. به تنظیمات «اعلان تماس‌های ورودی» (notifCalls) و «لرزش»
// (notifVibrate) گوش می‌ده — دقیقاً هم‌خانواده‌ی useDesktopNotifications
// که همین کار رو برای پیام‌های متنی انجام می‌ده.
export default function useCallNotifications() {
    const settingsRef = useRef(useSettingsStore.getState());

    useEffect(() => {
        return useSettingsStore.subscribe((state) => {
            settingsRef.current = state;
        });
    }, []);

    useEffect(() => {
        if (typeof Notification === "undefined") return;

        return useCallStore.subscribe((state, prevState) => {
            // تماس خصوصی: لحظه‌ای که وضعیت تازه به "ringing" تغییر می‌کنه
            const justStartedRinging = state.callStatus === "ringing" && prevState.callStatus !== "ringing";
            // تماس گروهی: لحظه‌ای که یه دعوت جدید می‌رسه
            const justGotGroupInvite =
                state.groupCallInvite && state.groupCallInvite !== prevState.groupCallInvite;

            if (!justStartedRinging && !justGotGroupInvite) return;
            if (!settingsRef.current.notifCalls) return;
            if (Notification.permission !== "granted") return;
            // اگه کاربر همین الان داره به اپ نگاه می‌کنه، UI خود تماس
            // (زنگ‌خوردن روی صفحه) کافیه؛ نوتیفیکیشن جدا لازم نیست
            if (document.visibilityState === "visible") return;

            let title;
            let body;
            let icon;

            if (justStartedRinging) {
                title = state.remoteUser?.name || "تماس ورودی";
                body = state.callType === "video" ? "📹 تماس تصویری" : "📞 تماس صوتی";
                icon = state.remoteUser?.image || "/avatar.png";
            } else {
                title = state.groupCallInvite.groupName || "تماس گروهی";
                body = state.groupCallInvite.fromName
                    ? `${state.groupCallInvite.fromName} یه تماس گروهی شروع کرده`
                    : "تماس گروهی جدید";
                icon = state.groupCallInvite.fromImage || "/avatar.png";
            }

            try {
                const notif = new Notification(title, {
                    body,
                    icon,
                    silent: !settingsRef.current.notifVibrate,
                    tag: "chatify-call",
                });

                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };

                if (settingsRef.current.notifVibrate && navigator.vibrate) {
                    // الگوی لرزش متمایز از پیام معمولی، چون تماس فوری‌تره
                    navigator.vibrate([300, 100, 300, 100, 300]);
                }
            } catch {
                // ساخت نوتیفیکیشن ممکنه شکست بخوره (مثلاً مرورگر بلاکش کنه)؛
                // بی‌سروصدا نادیده می‌گیریم تا جریان تماس مختل نشه
            }
        });
    }, []);
}