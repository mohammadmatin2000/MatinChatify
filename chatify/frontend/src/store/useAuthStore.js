import {create} from "zustand";
import axios from "axios";
import toast from "react-hot-toast";
import {API_URL} from "../lib/apiConfig";
const BASE_URL = API_URL;


let refreshTimer = null;
let isRefreshing = false;
let refreshWaiters = [];

function notifyWaiters(newAccessToken) {
    refreshWaiters.forEach((resolve) => resolve(newAccessToken));
    refreshWaiters = [];
}

async function performTokenRefresh() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("no refresh token");

    // از axios خامِ بدون interceptor استفاده نمی‌کنیم لازم نیست چون این
    // درخواست خودش هدف نیست که 401 بگیره؛ اگه بگیره یعنی واقعاً منقضی شده
    const res = await axios.post(`${BASE_URL}/accounts/token/refresh/`, {
        refresh: refreshToken,
    });

    const newAccess = res.data.access;
    const newRefresh = res.data.refresh; // چون ROTATE_REFRESH_TOKENS روشنه

    localStorage.setItem("accessToken", newAccess);
    if (newRefresh) localStorage.setItem("refreshToken", newRefresh);

    return newAccess;
}

// ✅ NEW: تمدید پیش‌دستانه — قبل از اینکه توکن ۱۲ ساعته منقضی بشه، خودمون
// از قبل تازه‌ش می‌کنیم. این باعث می‌شه حتی درخواست‌هایی که با fetch()
// (نه axios) زده می‌شن هم همیشه توکن معتبر از localStorage بخونن، بدون
// اینکه اصلاً یه بار ۴۰۱ بگیرن.
function scheduleProactiveRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    // ۱۱ ساعت بعد (یک ساعت قبل از انقضای واقعی access token)
    refreshTimer = setTimeout(async () => {
        try {
            await performTokenRefresh();
        } catch (e) {
            console.warn("⚠️ تمدید پیش‌دستانه‌ی توکن ناموفق بود:", e);
        } finally {
            scheduleProactiveRefresh();
        }
    }, 11 * 60 * 60 * 1000);
}

function clearProactiveRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
}

// ✅ NEW: Axios interceptor — شبکه‌ی ایمنی. اگه به هر دلیلی (کامپیوتر
// خوابیده بوده، تایمر بالا هنوز نرسیده بوده، و غیره) یه درخواست ۴۰۱
// بگیره، خودکار با refresh token یه توکن جدید می‌گیره و همون درخواست
// رو یه‌بار دیگه با توکن تازه می‌فرسته — کاربر اصلاً چیزی حس نمی‌کنه.
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        const isAuthRoute =
            originalRequest?.url?.includes("/accounts/login") ||
            originalRequest?.url?.includes("/accounts/token/refresh") ||
            originalRequest?.url?.includes("/accounts/otp/") ||
            originalRequest?.url?.includes("/accounts/verify-2fa");

        if (status !== 401 || isAuthRoute || originalRequest?._retry) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (!localStorage.getItem("refreshToken")) {
            useAuthStore.getState().forceLogout();
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // یه درخواست دیگه همین الان داره توکن رو تمدید می‌کنه —
            // منتظر نتیجه‌ش می‌مونیم به‌جای اینکه دوبار تمدید بزنیم
            return new Promise((resolve, reject) => {
                refreshWaiters.push((newToken) => {
                    if (!newToken) {
                        reject(error);
                        return;
                    }
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    resolve(axios(originalRequest));
                });
            });
        }

        isRefreshing = true;
        try {
            const newAccess = await performTokenRefresh();
            isRefreshing = false;
            notifyWaiters(newAccess);
            scheduleProactiveRefresh();

            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return axios(originalRequest);
        } catch (refreshError) {
            isRefreshing = false;
            notifyWaiters(null);
            useAuthStore.getState().forceLogout();
            return Promise.reject(refreshError);
        }
    }
);

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
        const refreshToken = localStorage.getItem("refreshToken");

        // ✅ FIX: قبلاً اگه accessToken نبود، بدون چک کردن refreshToken
        // مستقیم کاربر رو خارج می‌کرد. الان اگه refresh token هنوز
        // معتبر باشه، همون اول یه access token تازه می‌گیره.
        if (!token && !refreshToken) {
            set({authUser: null, isCheckingAuth: false});
            return;
        }

        try {
            const res = await axios.get(`${BASE_URL}/accounts/profile/update/`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log("✅ User verified:", res.data);
            set({authUser: res.data});
            scheduleProactiveRefresh();

            // ✅ اتصال مرکزی وضعیت آنلاین (فقط یک‌بار، idempotent)
            const {useChatStore} = await import("./useChatStore");
            useChatStore.getState().connectOnlineStatusSocket();
        } catch (error) {
            // اگه علتش ۴۰۱ بوده، interceptor بالا خودش قبلاً تلاش کرده
            // که با refresh token دوباره امتحان کنه؛ اگه بازم اینجا
            // به catch رسیدیم یعنی واقعاً refresh token هم منقضی/نامعتبره
            console.error("❌ Auth check failed:", error);
            get().forceLogout();
        } finally {
            set({isCheckingAuth: false});
        }
    },

    // 🔐 ورود با ایمیل
    login: async (email, password) => {
        try {
            const res = await axios.post(`${BASE_URL}/accounts/login/`, {
                email,
                password,
            });

            // ✅ اگه تایید دو مرحله‌ای فعال باشه، توکن هنوز صادر نشده
            if (res.data.two_step_required) {
                return {twoStepRequired: true, userId: res.data.user_id};
            }

            const {access, refresh, id, email: userEmail} = res.data;
            localStorage.setItem("accessToken", access);
            localStorage.setItem("refreshToken", refresh);

            const user = {id, email: userEmail};
            set({authUser: user});
            toast.success("✅ ورود موفق!");
            scheduleProactiveRefresh();

            const {useChatStore} = await import("./useChatStore");
            useChatStore.getState().connectOnlineStatusSocket();

            return user;
        } catch (error) {
            toast.error("❌ ورود ناموفق بود");
            console.error(error);
        }
    },

    // ✅ مرحله‌ی دوم لاگین — تایید کد دومرحله‌ای
    verify2FA: async (userId, code) => {
        try {
            const res = await axios.post(`${BASE_URL}/accounts/verify-2fa/`, {
                user_id: userId,
                code,
            });

            const {access, refresh, id, email} = res.data;
            localStorage.setItem("accessToken", access);
            localStorage.setItem("refreshToken", refresh);

            const user = {id, email};
            set({authUser: user});
            toast.success("✅ ورود موفق!");
            scheduleProactiveRefresh();

            const {useChatStore} = await import("./useChatStore");
            useChatStore.getState().connectOnlineStatusSocket();

            return user;
        } catch (error) {
            const msg = error.response?.data?.detail || "کد وارد شده اشتباه است";
            toast.error(msg);
            return null;
        }
    },

    // 📱 مرحله ۱: درخواست کد OTP برای شماره
    requestOtp: async (phoneNumber) => {
        set({isSendingOtp: true});
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
            set({isSendingOtp: false});
        }
    },

    // 📱 مرحله ۲: تایید کد و ورود/ثبت‌نام خودکار
    verifyOtp: async (phoneNumber, code) => {
        set({isVerifyingOtp: true});
        try {
            const res = await axios.post(`${BASE_URL}/accounts/otp/verify/`, {
                phone_number: phoneNumber,
                code,
            });

            const {access, refresh, id, phone_number} = res.data;
            localStorage.setItem("accessToken", access);
            localStorage.setItem("refreshToken", refresh);

            const user = {id, phone_number};
            set({authUser: user});
            toast.success("✅ ورود موفق!");
            scheduleProactiveRefresh();

            const {useChatStore} = await import("./useChatStore");
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
            set({isVerifyingOtp: false});
        }
    },

    // ✅ NEW: خروج «خاموش» — وقتی refresh token واقعاً منقضی/نامعتبر شده
    // (نه با انتخاب خودِ کاربر)؛ بدون صدا زدن API لاگ‌اوت چون چیزی برای
    // بلاک‌لیست کردن نمونده و ممکنه خودش دوباره ۴۰۱ بده
    forceLogout: async () => {
        clearProactiveRefresh();
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        set({authUser: null});

        const {useChatStore} = await import("./useChatStore");
        useChatStore.getState().logout();
    },

    // 🚪 خروج (با انتخاب خودِ کاربر)
    logout: async () => {
        try {
            const refresh = localStorage.getItem("refreshToken");
            await axios.post(`${BASE_URL}/accounts/logout/`, {refresh});
        } catch (error) {
            console.warn("Logout API error (ignored):", error);
        } finally {
            clearProactiveRefresh();
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            set({authUser: null});

            const {useChatStore} = await import("./useChatStore");
            useChatStore.getState().logout();
        }
    },
}));