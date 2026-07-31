import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { formatDistanceToNowStrict, isToday, format } from "date-fns";
import { faIR } from "date-fns/locale";
import { ImageIcon, Trash2, Paperclip, MapPin, User as UserIcon, Phone } from "lucide-react";
import axios from "axios";

function formatLastMessageTime(date) {
  if (!date) return "";
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: faIR });
}

// شکل واقعی پیام توی useChatStore: { text, image, file, fileName, messageType, meta, createdAt }
// این تابع فقط camelCase/snake_case رو یکی می‌کنه، فیلد اختراعی اضافه نمی‌کنه
function normalizeMessage(raw) {
  if (!raw) return null;
  return {
    id: raw.id ?? raw._id ?? raw.tempId,
    text: raw.text ?? "",
    image: raw.image ?? raw.image_url ?? null,
    file: raw.file ?? raw.file_url ?? null,
    fileName: raw.fileName ?? raw.file_name ?? null,
    messageType: raw.messageType ?? raw.message_type ?? "text",
    meta: raw.meta ?? null,
    deleted: !!raw.deleted,
    createdAt:
      raw.createdAt ??
      raw.created_at ??
      raw.created_date ??
      raw.timestamp ??
      null,
  };
}

// برچسب و آیکون preview رو بر اساس messageType تعیین می‌کنه.
// نوع‌هایی که دقیقاً نمی‌دونیم اسمشون چیه (مثلاً اشتراک مخاطب یا تماس تصویری) روی
// یه fallback عمومی می‌افتن، نه روی «هنوز پیامی ارسال نشده» — چون پیام واقعاً وجود داره.
function getPreview(msg) {
  if (!msg) return { text: "هنوز پیامی ارسال نشده", Icon: null, isPlaceholder: true };
  if (msg.deleted) return { text: "این پیام حذف شد", Icon: null, isPlaceholder: false };
  if (msg.text?.trim()) return { text: msg.text, Icon: null, isPlaceholder: false };

  switch (msg.messageType) {
    case "image":
      return { text: "عکس", Icon: ImageIcon, isPlaceholder: false };
    case "file":
      return { text: msg.fileName || "فایل", Icon: Paperclip, isPlaceholder: false };
    case "location":
      return { text: "موقعیت مکانی", Icon: MapPin, isPlaceholder: false };
    case "contact":
      return { text: "اشتراک مخاطب", Icon: UserIcon, isPlaceholder: false };
    case "call":
    case "video_call":
      return { text: "تماس تصویری", Icon: Phone, isPlaceholder: false };
    default:
      if (msg.image) return { text: "عکس", Icon: ImageIcon, isPlaceholder: false };
      if (msg.file) return { text: msg.fileName || "فایل", Icon: Paperclip, isPlaceholder: false };
      // نوع ناشناخته ولی پیام وجود داره — دروغ نگیم که خالیه
      return { text: "پیام", Icon: Paperclip, isPlaceholder: false };
  }
}

function ChatsList({ searchQuery = "" }) {
  const {
    getAllContacts,
    allContacts,
    isUsersLoading,
    setSelectedUser,
    onlineUsers,
    addMessageEventListener,
    deleteContact,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [lastMessages, setLastMessages] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);

  // ========================== دریافت لیست مخاطبین ==========================
  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // ========================== دریافت آخرین پیام‌ها (بار اول / fallback) ==========================
  const fetchLastMessage = async (contactId) => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await axios.get(`http://localhost:8000/chat/messages/${contactId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // بعضی از API ها جدیدترین رو اول می‌فرستن، بعضی آخر؛ هر دو حالت رو پوشش می‌دیم
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      if (list.length === 0) return;

      const sorted = [...list].sort((a, b) => {
        const da = new Date(a.createdAt ?? a.created_at ?? a.created_date ?? 0).getTime();
        const db = new Date(b.createdAt ?? b.created_at ?? b.created_date ?? 0).getTime();
        return db - da;
      });

      const normalized = normalizeMessage(sorted[0]);
      if (normalized) {
        setLastMessages((prev) => ({ ...prev, [contactId]: normalized }));
      }
    } catch (err) {
      console.error("Error fetching last message for", contactId, err);
    }
  };

  useEffect(() => {
    if (!allContacts || allContacts.length === 0) return;
    allContacts.forEach((contact) => {
      const contactId = contact?.id || contact?._id;
      if (!contactId) return;
      fetchLastMessage(contactId);
    });
  }, [allContacts]);

  // ========================== گوش دادن به رویدادهای پیام از اتصال مرکزی ==========================
  useEffect(() => {
    if (!authUser?.id) return;

    const unsubscribe = addMessageEventListener((data) => {
      switch (data.type) {
        case "new_message_notify": {
          const msg = normalizeMessage(data.message);
          if (!msg) break;
          const myId = String(authUser.id);
          const senderId = String(data.message.senderId ?? data.message.sender_id);
          const receiverId = String(data.message.receiverId ?? data.message.receiver_id);
          const contactId = senderId === myId ? receiverId : senderId;

          setLastMessages((prev) => ({
            ...prev,
            [contactId]: msg,
          }));
          break;
        }

        case "message_edit_notify": {
          setLastMessages((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((contactId) => {
              if (String(updated[contactId]?.id) === String(data.messageId)) {
                updated[contactId] = { ...updated[contactId], text: data.newText };
              }
            });
            return updated;
          });
          break;
        }

        case "message_delete_notify": {
          setLastMessages((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((contactId) => {
              if (String(updated[contactId]?.id) === String(data.messageId)) {
                updated[contactId] = {
                  ...updated[contactId],
                  text: "",
                  image: null,
                  file: null,
                  deleted: true,
                };
              }
            });
            return updated;
          });
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [authUser?.id, addMessageEventListener]);

  const handleDeleteClick = (e, contactRecordId) => {
    e.stopPropagation();

    if (confirmDeleteId === contactRecordId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      deleteContact(contactRecordId);
      setConfirmDeleteId(null);
      return;
    }

    setConfirmDeleteId(contactRecordId);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmDeleteId((current) => (current === contactRecordId ? null : current));
    }, 3000);
  };

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (!allContacts || allContacts.length === 0) return <NoChatsFound />;

  // فیلتر بر اساس سرچ (اسم یا ایمیل)
  const q = searchQuery.trim().toLowerCase();
  const filteredContacts = q
    ? allContacts.filter((contact) => {
        const name = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : allContacts;

  if (filteredContacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <p className="text-slate-400 text-sm">چیزی با این عبارت پیدا نشد</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-1.5 py-1">
      {filteredContacts.map((contact, idx) => {
        const contactId = contact?.id || contact?._id;
        if (!contactId) return null;

        const contactRecordId = contact.raw?.id;
        const isConfirming = confirmDeleteId === contactRecordId;

        const lastMessageObj = lastMessages[contactId];
        const { text: previewText, Icon: PreviewIcon, isPlaceholder } = getPreview(lastMessageObj);

        const lastMessageDate = lastMessageObj?.createdAt ? new Date(lastMessageObj.createdAt) : null;
        const timeLabel = formatLastMessageTime(lastMessageDate);
        const isOnline = onlineUsers.some((id) => String(id) === String(contactId));

        const displayName =
          contact.name?.trim() ||
          (contact.first_name || contact.last_name
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
            : contact.email?.split("@")[0]) ||
          "کاربر ناشناس";

        const profilePicUrl = contact.profile?.startsWith("http")
          ? contact.profile
          : contact.raw?.profile?.startsWith("http")
          ? contact.raw.profile
          : contact.raw?.profile
          ? `http://localhost:8000${contact.raw.profile}`
          : "/avatar.png";

        return (
          <div
            key={contactId}
            onClick={() => setSelectedUser(contact)}
            style={{ animationDelay: `${idx * 30}ms` }}
            className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer
                       bg-gradient-to-br from-slate-800/60 via-slate-800/30 to-slate-800/10
                       border border-slate-700/40 backdrop-blur-sm
                       hover:from-cyan-500/15 hover:via-blue-500/10 hover:to-transparent
                       hover:border-cyan-400/40 hover:-translate-y-0.5
                       hover:shadow-xl hover:shadow-cyan-500/10
                       active:scale-[0.98] active:translate-y-0
                       transition-all duration-300 ease-out
                       animate-[fadeIn_0.35s_ease-out_backwards]"
          >
            <div className="relative flex-shrink-0">
              <div
                className={`w-[52px] h-[52px] rounded-full overflow-hidden ring-2 transition-all duration-300 ${
                  isOnline
                    ? "ring-emerald-400/60 group-hover:ring-emerald-300"
                    : "ring-cyan-500/10 group-hover:ring-cyan-400/40"
                }`}
              >
                <img
                  src={profilePicUrl}
                  alt={displayName}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              </div>
              {isOnline && (
                <span className="absolute bottom-0 left-0 flex">
                  <span className="animate-ping absolute inline-flex w-3.5 h-3.5 rounded-full bg-green-400 opacity-60" />
                  <span className="relative w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-slate-900 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-slate-100 font-semibold text-[15px] truncate">{displayName}</h4>
                {timeLabel && !isConfirming && (
                  <span className="text-[11px] text-slate-500 flex-shrink-0 whitespace-nowrap group-hover:opacity-0 transition-opacity">
                    {timeLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                {PreviewIcon && !lastMessageObj?.deleted && (
                  <PreviewIcon className="w-3.5 h-3.5 text-cyan-400/70 flex-shrink-0" />
                )}
                <p
                  className={`text-[13px] truncate ${
                    lastMessageObj?.deleted
                      ? "italic text-slate-600"
                      : isPlaceholder
                      ? "text-slate-600"
                      : "text-slate-400"
                  }`}
                >
                  {previewText}
                </p>
              </div>
            </div>

            {/* دکمه‌ی حذف — فقط موقع hover دیده می‌شه */}
            {contactRecordId && (
              <button
                onClick={(e) => handleDeleteClick(e, contactRecordId)}
                className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                  isConfirming
                    ? "bg-red-500 text-white w-16 h-8 opacity-100 shadow-lg shadow-red-500/30"
                    : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                }`}
                title={isConfirming ? "تایید حذف" : "حذف گفتگو"}
              >
                {isConfirming ? (
                  <span className="text-xs font-medium">مطمئنی؟</span>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default ChatsList;