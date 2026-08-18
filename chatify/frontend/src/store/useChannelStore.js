import { create } from "zustand";
import toast from "react-hot-toast";
import { API_URL } from "../lib/apiConfig";
const API_BASE_URL = API_URL;

export const useChannelStore = create((set, get) => ({
  channels: [],
  isChannelsLoading: false,
  selectedChannel: null,
  members: [],
  isMembersLoading: false,

  // ---------------- 📡 لیست چنل‌ها ----------------
  getAllChannels: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    set({ isChannelsLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      set({ channels: Array.isArray(data) ? data : [] });
    } catch {
      toast.error("خطا در دریافت چنل‌ها");
    } finally {
      set({ isChannelsLoading: false });
    }
  },

  setSelectedChannel: (channel) => set({ selectedChannel: channel, members: [] }),
  clearSelectedChannel: () => set({ selectedChannel: null, members: [] }),

  // ---------------- ➕ ساخت چنل ----------------
  createChannel: async ({ name, description, isPublic }) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, is_public: isPublic }),
      });
      if (!res.ok) {
        toast.error("خطا در ساخت چنل");
        return null;
      }
      const data = await res.json();
      toast.success("چنل با موفقیت ساخته شد ✅");
      get().getAllChannels();
      return data;
    } catch {
      toast.error("خطا در ساخت چنل");
      return null;
    }
  },

  // ---------------- 🔗 جوین با کد دعوت ----------------
  joinChannel: async (inviteCode) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/join/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "این کد دعوت معتبر نیست");
        return null;
      }
      const data = await res.json();
      toast.success(`به چنل «${data.name}» پیوستی ✅`);
      get().getAllChannels();
      return data;
    } catch {
      toast.error("خطا در پیوستن به چنل");
      return null;
    }
  },

  // ---------------- 🚪 خروج از چنل ----------------
  leaveChannel: async (channelId) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/leave/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "خطا در خروج از چنل");
        return false;
      }
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
        selectedChannel: state.selectedChannel?.id === channelId ? null : state.selectedChannel,
      }));
      toast.success("از چنل خارج شدی");
      return true;
    } catch {
      toast.error("خطا در خروج از چنل");
      return false;
    }
  },

  // ---------------- 🗑 حذف چنل (فقط مالک) ----------------
  deleteChannel: async (channelId) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("حذف چنل ممکن نشد (فقط مالک اجازه داره)");
        return false;
      }
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
        selectedChannel: state.selectedChannel?.id === channelId ? null : state.selectedChannel,
      }));
      toast.success("چنل حذف شد");
      return true;
    } catch {
      toast.error("خطا در حذف چنل");
      return false;
    }
  },

  // ---------------- 👥 اعضا (فقط ادمین می‌تونه صداش بزنه، بک‌اند خودش ۴۰۳ برمی‌گردونه) ----------------
  fetchMembers: async (channelId) => {
    const token = localStorage.getItem("accessToken");
    if (!token || !channelId) return;
    set({ isMembersLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/members/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        set({ members: [] });
        return;
      }
      const data = await res.json();
      set({ members: Array.isArray(data) ? data : [] });
    } catch {
      toast.error("خطا در دریافت اعضا");
    } finally {
      set({ isMembersLoading: false });
    }
  },

  addMember: async ({ channelId, phoneNumber, email, userId, role = "subscriber" }) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;
    try {
      const body = { role };
      if (phoneNumber) body.phone_number = phoneNumber;
      if (email) body.email = email;
      if (userId) body.user_id = userId;

      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/add-member/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = err.phone_number?.[0] || err.email?.[0] || err.detail || "خطا در افزودن عضو";
        toast.error(msg);
        return false;
      }

      toast.success("عضو با موفقیت اضافه شد");
      get().fetchMembers(channelId);
      return true;
    } catch {
      toast.error("خطا در افزودن عضو");
      return false;
    }
  },

  // ---------------- 🔧 تغییر نقش عضو (ارتقا به ادمین / عزل از ادمین) ----------------
  updateMemberRole: async (channelId, memberId, role) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/members/${memberId}/role/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "خطا در تغییر نقش عضو");
        return false;
      }
      toast.success(role === "admin" ? "به ادمین ارتقا یافت" : "از ادمینی عزل شد");
      get().fetchMembers(channelId);
      return true;
    } catch {
      toast.error("خطا در تغییر نقش عضو");
      return false;
    }
  },

  // ---------------- ❌ حذف/اخراج عضو ----------------
  removeMember: async (channelId, memberId) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/channels/${channelId}/members/${memberId}/remove/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "خطا در حذف عضو");
        return false;
      }
      set((state) => ({ members: state.members.filter((m) => m.id !== memberId) }));
      toast.success("عضو از چنل حذف شد");
      return true;
    } catch {
      toast.error("خطا در حذف عضو");
      return false;
    }
  },
}));