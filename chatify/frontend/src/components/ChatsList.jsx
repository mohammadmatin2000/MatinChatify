import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { formatDistanceToNowStrict, isToday, format } from "date-fns";
import { faIR } from "date-fns/locale";
import { ImageIcon, Trash2 } from "lucide-react";
import axios from "axios";

function formatLastMessageTime(date) {
  if (!date) return "";
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: faIR });
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
      const lastMsg = res.data[0] || null;
      if (lastMsg) {
        setLastMessages((prev) => ({ ...prev, [contactId]: lastMsg }));
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
          const msg = data.message;
          const myId = String(authUser.id);
          const senderId = String(msg.senderId);
          const receiverId = String(msg.receiverId);
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
                updated[contactId] = { ...updated[contactId], text: "", image: null, deleted: true };
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

  // ✅ فیلتر بر اساس سرچ (اسم یا ایمیل)
  const q = searchQuery.trim().toLowerCase();
  const filteredContacts = q
    ? allContacts.filter((contact) => {
        const name = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : allContacts;

  if (filteredContacts.length === 0) {
    return <p className="text-center text-slate-500 text-sm py-8">چیزی با این عبارت پیدا نشد</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {filteredContacts.map((contact) => {
        const contactId = contact?.id || contact?._id;
        if (!contactId) return null;

        const contactRecordId = contact.raw?.id;
        const isConfirming = confirmDeleteId === contactRecordId;

        const lastMessageObj = lastMessages[contactId];
        const hasImage = !!lastMessageObj?.image;
        const hasText = !!lastMessageObj?.text?.trim();

        let previewText;
        if (lastMessageObj?.deleted) {
          previewText = "این پیام حذف شد";
        } else if (hasText) {
          previewText = lastMessageObj.text;
        } else if (hasImage) {
          previewText = "عکس";
        } else {
          previewText = "هنوز پیامی ارسال نشده";
        }

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
            className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer
                       bg-gradient-to-r from-slate-800/40 to-slate-800/10 border border-slate-700/40
                       hover:from-cyan-500/10 hover:to-blue-500/5 hover:border-cyan-500/30
                       hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200"
          >
            <div className="relative flex-shrink-0">
              <div className="w-[52px] h-[52px] rounded-full overflow-hidden ring-2 ring-cyan-500/10 group-hover:ring-cyan-400/40 transition-all">
                <img
                  src={profilePicUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              </div>
              {isOnline && (
                <span className="absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-slate-900 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
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

              <div className="flex items-center gap-1 mt-0.5">
                {hasImage && !hasText && !lastMessageObj?.deleted && (
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                )}
                <p
                  className={`text-[13px] truncate ${
                    lastMessageObj?.deleted
                      ? "italic text-slate-600"
                      : hasText || hasImage
                      ? "text-slate-400"
                      : "text-slate-600"
                  }`}
                >
                  {previewText}
                </p>
              </div>
            </div>

            {/* ✅ دکمه‌ی حذف — فقط موقع hover دیده می‌شه */}
            {contactRecordId && (
              <button
                onClick={(e) => handleDeleteClick(e, contactRecordId)}
                className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                  isConfirming
                    ? "bg-red-500 text-white w-16 h-8 opacity-100"
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
    </div>
  );
}

export default ChatsList;