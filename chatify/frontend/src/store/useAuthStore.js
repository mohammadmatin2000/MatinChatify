import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";
// ✅ FIX: قبلاً اینجا `import { useChatStore } from "./useChatStore";` بود
// که یه وابستگی چرخشی استاتیک می‌ساخت (useChatStore.js هم بالای فایلش
// useAuthStore رو import می‌کنه). این حلقه زیر HMR ویت گاهی باعث می‌شد
// یکی از دو ماژول قبل از کامل شدن export هاش استفاده بشه و این خطا بده:
// "does not provide an export named 'useChatStore'". با dynamic import
// داخل خود توابع، این حلقه‌ی استاتیک قطع می‌شه.

const BASE_URL = "http://127.0.0.1:8000";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSendingOtp: false,
  isVerifyingOtp: false,

  // ✅ ایجاد instance از axios
  axiosInstance: axios.create({
    baseURL: BASE_URL,
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
      const res = await axios.get(`${BASE_URL}/accounts/profile/update/`, {
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
      localStorage.removeItem("refreshToken");
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  // 🔐 ورود با ایمیل
  login: async (email, password) => {
    try {
      const res = await axios.post(`${BASE_URL}/accounts/login/`, {
        email,
        password,
      });

      const { access, refresh, id, email: userEmail } = res.data;
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);

      const user = { id, email: userEmail };
      set({ authUser: user });
      toast.success("✅ ورود موفق!");

      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().connectOnlineStatusSocket();

      return user;
    } catch (error) {
      toast.error("❌ ورود ناموفق بود");
      console.error(error);
    }
  },

  // 📱 مرحله ۱: درخواست کد OTP برای شماره
  requestOtp: async (phoneNumber) => {
    set({ isSendingOtp: true });
    try {
      await axios.post(`${BASE_URL}/accounts/otp/request/`, {
        phone_number: phoneNumber,
      });
      toast.success("کد تایید ارسال شد ✅");
      return true;
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.phone_number?.[0] ||
        "ارسال کد ناموفق بود";
      toast.error(msg);
      return false;
    } finally {
      set({ isSendingOtp: false });
    }
  },

  // 📱 مرحله ۲: تایید کد و ورود/ثبت‌نام خودکار
  verifyOtp: async (phoneNumber, code) => {
    set({ isVerifyingOtp: true });
    try {
      const res = await axios.post(`${BASE_URL}/accounts/otp/verify/`, {
        phone_number: phoneNumber,
        code,
      });

      const { access, refresh, id, phone_number } = res.data;
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);

      const user = { id, phone_number };
      set({ authUser: user });
      toast.success("✅ ورود موفق!");

      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().connectOnlineStatusSocket();

      return user;
    } catch (error) {
      const msg =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.detail ||
        "کد وارد شده اشتباه است";
      toast.error(msg);
      return null;
    } finally {
      set({ isVerifyingOtp: false });
    }
  },

  // 🚪 خروج
  logout: async () => {
    try {
      const refresh = localStorage.getItem("refreshToken");
      await axios.post(`${BASE_URL}/accounts/logout/`, { refresh });
    } catch (error) {
      console.warn("Logout API error (ignored):", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      set({ authUser: null });

      const { useChatStore } = await import("./useChatStore");
      useChatStore.getState().logout();
    }
  },
}));