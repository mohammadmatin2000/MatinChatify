import { XIcon, MessageCircleIcon, UsersIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

const resolveUrl = (url) => {
  if (!url) return "/avatar.png";
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
};

// ✅ NEW: فرستادن پیام به یه گروه از طریق یه WebSocket موقت — بدون نیاز به
// اینکه کاربر واقعاً اون گروه رو باز/انتخاب کرده باشه (برخلاف چت خصوصی که
// از سوکت اصلی useChatStore استفاده می‌کنه، گروه‌ها سوکت جدا به‌ازای هر
// گروه دارن، پس یه سوکت موقت می‌سازیم، پیام رو می‌فرستیم، و می‌بندیمش)
function sendToGroupViaTempSocket(groupId, payload) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return reject(new Error("no token"));

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.hostname}:8000/ws/groups/${groupId}/?token=${token}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timeout"));
    }, 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "message", ...payload }));
      // یه لحظه صبر می‌کنیم تا مطمئن بشیم پیام واقعاً روی سیم رفته، بعد می‌بندیم
      setTimeout(() => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }, 400);
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });
}

// فوروارد پیام به یکی از مخاطبین چت خصوصی، یا یکی از گروه‌ها
function ForwardMessageModal({ isOpen, onClose, message }) {
  const { allContacts, getAllContacts, setSelectedUser } = useChatStore();
  const [sendingId, setSendingId] = useState(null);
  const [activeTab, setActiveTab] = useState("contacts"); // "contacts" | "groups"
  const [groups, setGroups] = useState([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) getAllContacts();
  }, [isOpen, getAllContacts]);

  useEffect(() => {
    if (!isOpen || activeTab !== "groups") return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    setIsGroupsLoading(true);
    axios
      .get(`${API_BASE_URL}/groups/groups/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setGroups(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((err) => {
        console.error("❌ خطا در گرفتن لیست گروه‌ها:", err);
        toast.error("گرفتن لیست گروه‌ها ممکن نشد");
      })
      .finally(() => setIsGroupsLoading(false));
  }, [isOpen, activeTab]);

  if (!isOpen || !message) return null;

  const waitForSocket = () =>
    new Promise((resolve) => {
      let tries = 0;
      const check = () => {
        const socket = useChatStore.getState().socket;
        tries += 1;
        if (socket?.readyState === WebSocket.OPEN || tries > 20) resolve(socket);
        else setTimeout(check, 100);
      };
      check();
    });

  const buildPayload = () => ({
    text: message.text || "",
    image: message.image || null,
    file: message.file || null,
    fileName: message.fileName || null,
    messageType: message.messageType || (message.image ? "image" : message.file ? "file" : "text"),
    meta: message.meta || null,
  });

  const handleForwardToContact = async (contact) => {
    const contactId = contact._id || contact.id;
    setSendingId(contactId);
    try {
      setSelectedUser(contact);
      const socket = await waitForSocket();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        toast.error("اتصال چت برقرار نشد — خودت این چت رو باز کن و دوباره امتحان کن");
        return;
      }

      await useChatStore.getState().sendMessage(buildPayload());

      toast.success(`پیام برای ${contact.name} فوروارد شد`);
      onClose();
    } catch (err) {
      console.error("خطا در فوروارد پیام:", err);
      toast.error("فوروارد ممکن نشد");
    } finally {
      setSendingId(null);
    }
  };

  // ✅ NEW: فوروارد به گروه — از سوکت موقت استفاده می‌کنه
  const handleForwardToGroup = async (group) => {
    const groupId = group.id;
    setSendingId(`group-${groupId}`);
    try {
      await sendToGroupViaTempSocket(groupId, buildPayload());
      toast.success(`پیام برای گروه «${group.name}» فوروارد شد`);
      onClose();
    } catch (err) {
      console.error("خطا در فوروارد به گروه:", err);
      toast.error("فوروارد به گروه ممکن نشد");
    } finally {
      setSendingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-semibold text-base">فوروارد به...</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ✅ NEW: تب‌های مخاطبین / گروه‌ها */}
        <div className="flex border-b border-slate-700/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "contacts" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400"
            }`}
          >
            <MessageCircleIcon className="w-3.5 h-3.5" />
            مخاطبین
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "groups" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400"
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            گروه‌ها
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {activeTab === "contacts" &&
            (allContacts.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">مخاطبی نداری</p>
            ) : (
              allContacts.map((c) => {
                const cid = c._id || c.id;
                const profilePic = c.profile?.startsWith("http")
                  ? c.profile
                  : c.raw?.profile?.startsWith("http")
                  ? c.raw.profile
                  : c.raw?.profile
                  ? `${API_BASE_URL}${c.raw.profile}`
                  : "/avatar.png";
                return (
                  <button
                    key={cid}
                    disabled={sendingId === cid}
                    onClick={() => handleForwardToContact(c)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 text-right transition-colors disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                      <img
                        src={profilePic}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target.src = "/avatar.png")}
                      />
                    </div>
                    <span className="text-slate-200 text-sm truncate flex-1">{c.name}</span>
                    {sendingId === cid && <span className="text-xs text-cyan-400 flex-shrink-0">در حال ارسال...</span>}
                  </button>
                );
              })
            ))}

          {activeTab === "groups" &&
            (isGroupsLoading ? (
              <p className="text-center text-slate-500 text-sm py-8">در حال بارگذاری...</p>
            ) : groups.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">تو هیچ گروهی عضو نیستی</p>
            ) : (
              groups.map((g) => {
                const sendKey = `group-${g.id}`;
                return (
                  <button
                    key={g.id}
                    disabled={sendingId === sendKey}
                    onClick={() => handleForwardToGroup(g)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 text-right transition-colors disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0 flex items-center justify-center bg-slate-700">
                      {g.avatar ? (
                        <img
                          src={resolveUrl(g.avatar)}
                          alt={g.name}
                          className="w-full h-full object-cover"
                          onError={(e) => (e.target.src = "/avatar.png")}
                        />
                      ) : (
                        <UsersIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="text-slate-200 text-sm truncate flex-1">{g.name}</span>
                    {sendingId === sendKey && <span className="text-xs text-cyan-400 flex-shrink-0">در حال ارسال...</span>}
                  </button>
                );
              })
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ForwardMessageModal;