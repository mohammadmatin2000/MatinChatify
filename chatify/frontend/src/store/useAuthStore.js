import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatStore } from "./useChatStore";

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
      useChatStore.getState().logout();
    }
  },
}));