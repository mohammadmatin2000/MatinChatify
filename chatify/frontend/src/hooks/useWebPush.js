import { API_URL } from "../lib/apiConfig";
const API_BASE_URL = API_URL;
const VAPID_PUBLIC_KEY = "همون Public Key که از web-push generate-vapid-keys گرفتی";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function useWebPush() {
  const register = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      await navigator.serviceWorker.ready;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await fetch(`${API_BASE_URL}/settings/push/subscribe/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.warn("خطا در ثبت Web Push:", err);
    }
  };

  return { register };
}