import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { formatDistanceToNowStrict, isToday, format } from "date-fns";
import { faIR } from "date-fns/locale";
import { ImageIcon } from "lucide-react";
import axios from "axios";

function formatLastMessageTime(date) {
  if (!date) return "";
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: faIR });
}

function ChatsList({ searchQuery = "" }) {
  const { getAllContacts, allContacts, isUsersLoading, setSelectedUser, onlineUsers, addMessageEventListener } =
    useChatStore();
  const { authUser } = useAuthStore();
  const [lastMessages, setLastMessages] = useState({});

  // ========================== دریافت لیست مخاطبین ==========================
  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

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
    return (
      <p className="text-center text-slate-500 text-sm py-8">چیزی با این عبارت پیدا نشد</p>
    );
  }

  return (
    <div className="flex flex-col">
      {filteredContacts.map((contact) => {
        const contactId = contact?.id || contact?._id;
        if (!contactId) return null;

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
            className="flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-xl cursor-pointer
                       hover:bg-slate-800/60 active:bg-slate-800 transition-colors duration-150"
          >
            <div className="relative flex-shrink-0">
              <div className="w-[52px] h-[52px] rounded-full overflow-hidden ring-1 ring-slate-700/70">
                <img
                  src={profilePicUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              </div>
              {isOnline && (
                <span className="absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-slate-900" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-slate-100 font-semibold text-[15px] truncate">{displayName}</h4>
                {timeLabel && (
                  <span className="text-[11px] text-slate-500 flex-shrink-0 whitespace-nowrap">{timeLabel}</span>
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
          </div>
        );
      })}
    </div>
  );
}

export default ChatsList;