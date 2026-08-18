import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChannelStore } from "../store/useChannelStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import useTranslation from "../hooks/useTranslation";
import { formatDistanceToNowStrict, isToday, format } from "date-fns";
import { faIR, enUS, de } from "date-fns/locale";
import { ImageIcon, Trash2, Paperclip, MapPin, User as UserIcon, Phone } from "lucide-react";
import { API_URL } from "../lib/apiConfig";

const DATE_LOCALES = { fa: faIR, en: enUS, de };

function formatLastMessageTime(date, locale) {
  if (!date) return "";
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true, locale });
}

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

function getPreview(msg, t) {
  if (!msg) return { text: t("chatsList.noMessagesYet"), Icon: null, isPlaceholder: true };
  if (msg.deleted) return { text: t("chatsList.deleted"), Icon: null, isPlaceholder: false };
  if (msg.text?.trim()) return { text: msg.text, Icon: null, isPlaceholder: false };

  switch (msg.messageType) {
    case "image":
      return { text: t("chatsList.image"), Icon: ImageIcon, isPlaceholder: false };
    case "file":
      return { text: msg.fileName || t("chatsList.file"), Icon: Paperclip, isPlaceholder: false };
    case "location":
      return { text: t("chatsList.location"), Icon: MapPin, isPlaceholder: false };
    case "contact":
      return { text: t("chatsList.contact"), Icon: UserIcon, isPlaceholder: false };
    case "call":
    case "video_call":
      return { text: t("chatsList.videoCall"), Icon: Phone, isPlaceholder: false };
    default:
      if (msg.image) return { text: t("chatsList.image"), Icon: ImageIcon, isPlaceholder: false };
      if (msg.file) return { text: msg.fileName || t("chatsList.file"), Icon: Paperclip, isPlaceholder: false };
      return { text: t("chatsList.message"), Icon: Paperclip, isPlaceholder: false };
  }
}

function ChatsList({ searchQuery = "" }) {
  const {
    getChatList,
    chatList,
    isChatListLoading,
    setSelectedUser,
    setSelectedGroup,
    onlineUsers,
    addMessageEventListener,
    // ✅ CHANGED: قبلاً اینجا deleteContact بود — الان deleteConversation
    // (پاک کردن خودِ چت از لیست، بدون اینکه مخاطب حذف بشه)
    deleteConversation,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const { setSelectedChannel } = useChannelStore();
  const { t, language } = useTranslation();
  const dateLocale = DATE_LOCALES[language] || faIR;

  const [lastMessages, setLastMessages] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    getChatList();
  }, [getChatList]);

  // مقداردهی اولیه‌ی lastMessages از خود لیست مکالمات (که last_message رو داره)
  useEffect(() => {
    if (!chatList || chatList.length === 0) return;
    const initial = {};
    chatList.forEach((c) => {
      const normalized = normalizeMessage(c.last_message);
      if (normalized) initial[c.id] = normalized;
    });
    setLastMessages((prev) => ({ ...initial, ...prev }));
  }, [chatList]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

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

          // ✅ اگه این یه مکالمه‌ی کاملاً جدیده (طرف قبلاً توی لیست نبود)، لیست رو رفرش کن
          const alreadyInList = chatList.some((c) => String(c.id) === contactId);
          if (!alreadyInList) {
            getChatList();
          }
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
  }, [authUser?.id, addMessageEventListener, chatList, getChatList]);

  const handleSelectUser = (contact) => {
    setSelectedGroup(null);
    setSelectedChannel(null);
    setSelectedUser(contact);
  };

  // ✅ CHANGED: contactId (طرف مقابل مکالمه) رو می‌گیره، نه contactRecordId
  // (چون deleteConversation بر اساس شناسه‌ی کاربر طرف مقابل عمل می‌کنه، نه رکورد Contact)
  const handleDeleteClick = (e, contactId) => {
    e.stopPropagation();
    if (!contactId) return;

    if (confirmDeleteId === contactId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      deleteConversation(contactId);
      setConfirmDeleteId(null);
      return;
    }

    setConfirmDeleteId(contactId);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmDeleteId((current) => (current === contactId ? null : current));
    }, 3000);
  };

  if (isChatListLoading) return <UsersLoadingSkeleton />;
  if (!chatList || chatList.length === 0) return <NoChatsFound />;

  const q = searchQuery.trim().toLowerCase();
  const filteredList = q
    ? chatList.filter((contact) => {
        const name = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : chatList;

  if (filteredList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <p className="text-slate-400 text-sm">{t("common.noResults")}</p>
      </div>
    );
  }

  // ✅ مرتب‌سازی بر اساس آخرین پیام (جدیدترین بالا)
  const sortedList = [...filteredList].sort((a, b) => {
    const da = lastMessages[a.id]?.createdAt ? new Date(lastMessages[a.id].createdAt).getTime() : 0;
    const db = lastMessages[b.id]?.createdAt ? new Date(lastMessages[b.id].createdAt).getTime() : 0;
    return db - da;
  });

  return (
    <div className="flex flex-col gap-2 px-1.5 py-1">
      {sortedList.map((contact, idx) => {
        const contactId = contact.id;

        // ✅ CHANGED: تایید حذف الان بر اساس contactId چک می‌شه (نه contactRecordId)
        const isConfirming = confirmDeleteId === contactId;

        const lastMessageObj = lastMessages[contactId];
        const { text: previewText, Icon: PreviewIcon, isPlaceholder } = getPreview(lastMessageObj, t);

        const lastMessageDate = lastMessageObj?.createdAt ? new Date(lastMessageObj.createdAt) : null;
        const timeLabel = formatLastMessageTime(lastMessageDate, dateLocale);
        const isOnline = onlineUsers.some((id) => String(id) === String(contactId));

        const displayName = contact.name?.trim() || t("common.unknownUser");

        const profilePicUrl = contact.profile?.startsWith("http")
          ? contact.profile
          : contact.profile
          ? `${API_URL}${contact.profile}`
          : "/avatar.png";

        return (
          <div
            key={contactId}
            onClick={() => handleSelectUser(contact)}
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
                <h4 className="text-slate-100 font-semibold text-[15px] truncate flex items-center gap-1.5">
                  {displayName}
                  {!contact.is_contact && (
                    <span className="text-[10px] text-slate-500 font-normal">
                      · {t("chatsList.notInContacts") || "غریبه"}
                    </span>
                  )}
                </h4>
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

            {/* ✅ CHANGED: contactId رو می‌فرسته (نه contactRecordId) و همیشه نشون داده می‌شه
                (قبلاً فقط وقتی contactRecordId وجود داشت نشون داده می‌شد، یعنی فقط برای
                مخاطبین رسمی — ولی پاک کردن چت باید برای هر مکالمه‌ای کار کنه) */}
            <button
              onClick={(e) => handleDeleteClick(e, contactId)}
              className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                isConfirming
                  ? "bg-red-500 text-white w-16 h-8 opacity-100 shadow-lg shadow-red-500/30"
                  : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              }`}
              title={isConfirming ? t("contactList.deleteConfirm") : t("chatsList.deleteChatTitle")}
            >
              {isConfirming ? (
                <span className="text-xs font-medium">{t("common.confirm")}</span>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
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