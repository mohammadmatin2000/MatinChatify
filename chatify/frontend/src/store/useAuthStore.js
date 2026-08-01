import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";
// ✅ FIX: قبلاً اینجا `import { useChatStore } from "./useChatStore";` بود
// که یه وابستگی چرخشی استاتیک می‌ساخت (useChatStore.js هم بالای فایلش
// useAuthStore رو import می‌کنه). این حلقه زیر HMR ویت گاهی باعث می‌شد
// یکی از دو ماژول قبل از کامل شدن export هاش استفاده بشه و این خطا بده:
// "does not provide an export named 'useChatStore'". با dynamic import
// داخل خود توابع، این حلقه‌ی استاتیک قطع می‌شه.

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,

  // ✅ ایجاد instance از axios
  axiosInstance: axios.create({
    baseURL: "http://127.0.0.1:8000",
    withCredentials: true,
  }),

  // 🧠 تابع چک کردن احراز هویت
  checkAuth: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      set({ authUser: null, isCheckingAuth: false });
      return;
    }

    try {
      const res = await axios.get("http://127.0.0.1:8000/accounts/profile/update/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("✅ User verified:", res.data);
      set({ authUser: res.data });

      // ✅ اتصال مرکزی وضعیت آنلاین (فقط یک‌بار، idempotent)
      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().connectOnlineStatusSocket();
    } catch (error) {
      console.error("❌ Auth check failed:", error);
      localStorage.removeItem("accessToken");
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  // 🔐 ورود
  login: async (email, password) => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/accounts/login/", {
        email,
        password,
      });

      const { access, user } = res.data;
      localStorage.setItem("accessToken", access);
      set({ authUser: user });
      toast.success("✅ ورود موفق!");

      // ✅ اتصال مرکزی وضعیت آنلاین
      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().connectOnlineStatusSocket();

      return user;
    } catch (error) {
      toast.error("❌ ورود ناموفق بود");
      console.error(error);
    }
  },

  // 🚪 خروج
  logout: async () => {
    try {
      await axios.post("http://127.0.0.1:8000/accounts/logout/");
    } catch (error) {
      console.warn("Logout API error (ignored):", error);
    } finally {
      localStorage.removeItem("accessToken");
      set({ authUser: null });

      // ✅ بستن کامل اتصال مرکزی + پاکسازی state چت
      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().logout();
    }
  },
}));