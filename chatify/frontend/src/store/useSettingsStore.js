import { create } from "zustand";

const STORAGE_KEY = "chatify_settings";
const API_BASE_URL = "http://localhost:8000";

const defaultSettings = {
  notificationsEnabled: true,
  messagePreviewEnabled: true,
  onlineStatusVisible: true,
  readReceiptsEnabled: true,
  autoDownloadMedia: true,
  backgroundPatternEnabled: true,
  enterToSend: true,
  fontSize: "medium",
  chatWallpaper: "default",
  // ✅ NEW: این چهارتا الان با بک‌اند سینک می‌شن (بقیه فعلاً فقط local هستن)
  notifGroupsEnabled: true,
  notifCallsEnabled: true,
  notifVibrateEnabled: true,
  notifMessages: true,
  notifPreview: true,
  notifGroups: true,
  notifCalls: true,
  notifVibrate: true,
};

const FONT_SIZE_PX = { small: 14, medium: 16, large: 18 };

// ✅ NEW: نگاشت اسم فیلد فرانت به اسم فیلد بک‌اند — فقط تنظیمات اعلان
const BACKEND_FIELD_MAP = {
  notificationsEnabled: "notif_messages",
  messagePreviewEnabled: "notif_preview",
  notifGroupsEnabled: "notif_groups",
  notifCallsEnabled: "notif_calls",
  notifVibrateEnabled: "notif_vibrate",
};
const REVERSE_FIELD_MAP = Object.fromEntries(
  Object.entries(BACKEND_FIELD_MAP).map(([fe, be]) => [be, fe])
);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function persist(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota/storage errors
  }
}

function applyFontSize(size) {
  const px = FONT_SIZE_PX[size] || FONT_SIZE_PX.medium;
  document.documentElement.style.fontSize = `${px}px`;
}

applyFontSize(loadSettings().fontSize);

export const useSettingsStore = create((set, get) => ({
  ...loadSettings(),
  isSettingsLoading: false,
  settingsSaving: false,

  // ✅ NEW: موقع باز شدن مودال تنظیمات صدا زده می‌شه — از سرور می‌خونه
  // و مقادیر اعلان رو با local هماهنگ می‌کنه (سرور منبع درسته)
  fetchServerSettings: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    set({ isSettingsLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/settings/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      const patch = {};
      for (const [beField, feField] of Object.entries(REVERSE_FIELD_MAP)) {
        if (beField in data) patch[feField] = data[beField];
      }

      const next = { ...get(), ...patch };
      persist(next);
      set(patch);
    } catch {
      // ساکت — اگه سرور در دسترس نبود، مقادیر local همون قبلی می‌مونن
    } finally {
      set({ isSettingsLoading: false });
    }
  },

  toggleSetting: (key) => {
    const next = { ...get(), [key]: !get()[key] };
    persist(next);
    set({ [key]: next[key] });

    // ✅ NEW: اگه این کلید با بک‌اند سینک می‌شه، همزمان PATCH بفرست
    const backendField = BACKEND_FIELD_MAP[key];
    if (backendField) {
      get()._syncToServer({ [backendField]: next[key] });
    }
  },

  setSetting: (key, value) => {
    const next = { ...get(), [key]: value };
    persist(next);
    set({ [key]: value });
    if (key === "fontSize") applyFontSize(value);

    const backendField = BACKEND_FIELD_MAP[key];
    if (backendField) {
      get()._syncToServer({ [backendField]: value });
    }
  },

  // ✅ NEW: ارسال PATCH به سرور — داخلی، مستقیم صدا زده نمی‌شه
  _syncToServer: async (payload) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    set({ settingsSaving: true });
    try {
      await fetch(`${API_BASE_URL}/settings/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // ساکت — تغییر local همچنان اعمال می‌مونه، دفعه‌ی بعد دوباره تلاش می‌شه
    } finally {
      set({ settingsSaving: false });
    }
  },

  resetSettings: () => {
    persist(defaultSettings);
    set(defaultSettings);
    applyFontSize(defaultSettings.fontSize);
  },
}));