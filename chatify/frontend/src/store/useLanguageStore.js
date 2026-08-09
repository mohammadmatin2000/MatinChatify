import { create } from "zustand";
import { translations, formatTranslation, LANGUAGES } from "../lib/translations";

const API_BASE_URL = "http://localhost:8000";

const STORAGE_KEY = "appLanguage";

const getInitialLanguage = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES[saved]) return saved;
    return "fa";
};

// ✅ اعمال جهت (RTL/LTR) و lang روی خودِ <html> — این چیزیه که کل ظاهر
// (چیدمان، فونت، جهت اسکرول) رو واقعاً عوض می‌کنه
const applyDocumentDirection = (lang) => {
    const dir = LANGUAGES[lang]?.dir || "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
};

// اولین بار که فایل لود می‌شه هم اعمالش کن (قبل از رندر اولیه‌ی React)
applyDocumentDirection(getInitialLanguage());

export const useLanguageStore = create((set, get) => ({
    language: getInitialLanguage(),

    // ✅ فقط سمت کلاینت عوض می‌کنه (فوری، بدون نیاز به سرور) — برای وقتی
    // که فقط می‌خوایم زبون رو لحظه‌ای عوض کنیم
    setLanguageLocal: (lang) => {
        if (!LANGUAGES[lang]) return;
        localStorage.setItem(STORAGE_KEY, lang);
        applyDocumentDirection(lang);
        set({ language: lang });
    },

    // ✅ عوض می‌کنه + به بک‌اند هم می‌فرسته که بین دستگاه‌های کاربر سینک بمونه
    setLanguage: async (lang) => {
        get().setLanguageLocal(lang);

        const token = localStorage.getItem("accessToken");
        if (!token) return;
        try {
            await fetch(`${API_BASE_URL}/settings/`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ language: lang }),
            });
        } catch {
            // اگه سینک با سرور fail بشه مهم نیست، زبون همچنان سمت کلاینت عوض شده
        }
    },

    // ✅ وقتی تنظیمات از سرور لود می‌شه (مثلاً موقع باز کردن پنل تنظیمات)،
    // این صدا زده می‌شه تا اگه کاربر از یه دستگاه دیگه زبونشو عوض کرده،
    // اینجا هم خودشو با سرور هماهنگ کنه (بدون دوباره PATCH زدن)
    syncFromServer: (lang) => {
        if (!LANGUAGES[lang] || lang === get().language) return;
        get().setLanguageLocal(lang);
    },

    // ✅ تابع ترجمه — همه‌جای اپ با useTranslation صداش می‌زنن
    t: (key, vars) => {
        const lang = get().language;
        const raw = translations[lang]?.[key] ?? translations.fa[key] ?? key;
        return vars ? formatTranslation(raw, vars) : raw;
    },
}));