import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useSettingsStore } from "../store/useSettingsStore";
import ChatHeader from "./ChatHeader";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import MessageInput from "./MessageInput";
import MessageTicks from "./MessageTicks";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageContextMenu from "./MessageContextMenu";
import MessageInfoModal from "./MessageInfoModal";
import ForwardMessageModal from "./ForwardMessageModal";
import toast from "react-hot-toast";
import { FileTextIcon, MapPinIcon, UserIcon, DownloadIcon, XIcon, Pin, Star, CheckIcon, Ban } from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

const resolveUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE_URL}${url}`);

// ✅ NEW: نگاشت گزینه‌ی پس‌زمینه‌ی انتخاب‌شده در تنظیمات به کلاس واقعی Tailwind
const WALLPAPER_CLASSES = {
  default: "",
  midnight: "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950",
  aurora:
    "bg-slate-950 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.16),transparent_45%),radial-gradient(circle_at_85%_5%,rgba(168,85,247,0.14),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.12),transparent_50%)]",
  sunset: "bg-gradient-to-br from-orange-950/50 via-slate-900 to-rose-950/40",
  ocean: "bg-gradient-to-br from-cyan-950/60 via-slate-900 to-blue-950/40",
  forest: "bg-gradient-to-br from-emerald-950/60 via-slate-900 to-teal-950/30",
  grid: "bg-slate-950 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[length:24px_24px]",
  dots: "bg-slate-950 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:18px_18px]",
  // -------- گزینه‌های جدید --------
  candy: "bg-gradient-to-br from-fuchsia-950/50 via-slate-900 to-indigo-950/50",
  amber: "bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950",
  starry:
    "bg-slate-950 bg-[radial-gradient(1.5px_1.5px_at_20px_30px,rgba(255,255,255,0.5),transparent),radial-gradient(1.5px_1.5px_at_90px_60px,rgba(255,255,255,0.4),transparent),radial-gradient(1px_1px_at_150px_20px,rgba(255,255,255,0.35),transparent),radial-gradient(1.5px_1.5px_at_50px_100px,rgba(255,255,255,0.3),transparent)] bg-[length:180px_180px]",
  diagonal:
    "bg-slate-950 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.06)_0px,rgba(148,163,184,0.06)_1px,transparent_1px,transparent_14px)]",
  monochrome: "bg-slate-900",
};

// توی ProfileHeader.jsx جای WALLPAPER_OPTIONS فعلی بذار:
const WALLPAPER_OPTIONS = [
  { id: "default", label: "پیش‌فرض", preview: "bg-slate-900" },
  { id: "midnight", label: "نیمه‌شب", preview: "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" },
  {
    id: "aurora",
    label: "شفق قطبی",
    preview:
      "bg-slate-950 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.35),transparent_45%),radial-gradient(circle_at_85%_5%,rgba(168,85,247,0.35),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.3),transparent_50%)]",
  },
  { id: "sunset", label: "غروب", preview: "bg-gradient-to-br from-orange-600 via-rose-800 to-slate-950" },
  { id: "ocean", label: "اقیانوس", preview: "bg-gradient-to-br from-cyan-500 via-blue-800 to-slate-950" },
  { id: "forest", label: "جنگل", preview: "bg-gradient-to-br from-emerald-500 via-teal-800 to-slate-950" },
  {
    id: "grid",
    label: "شبکه‌ای",
    preview:
      "bg-slate-800 bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[length:10px_10px]",
  },
  {
    id: "dots",
    label: "نقطه‌چین",
    preview: "bg-slate-800 bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:10px_10px]",
  },
  { id: "candy", label: "بنفش‌آبی", preview: "bg-gradient-to-br from-fuchsia-500 via-purple-700 to-indigo-950" },
  { id: "amber", label: "کهربایی", preview: "bg-gradient-to-br from-amber-500 via-orange-700 to-slate-950" },
  {
    id: "starry",
    label: "پرستاره",
    preview:
      "bg-slate-900 bg-[radial-gradient(1.5px_1.5px_at_20px_30px,rgba(255,255,255,0.9),transparent),radial-gradient(1.5px_1.5px_at_60px_10px,rgba(255,255,255,0.8),transparent),radial-gradient(1px_1px_at_90px_50px,rgba(255,255,255,0.7),transparent),radial-gradient(1.5px_1.5px_at_30px_70px,rgba(255,255,255,0.6),transparent)] bg-[length:100px_100px]",
  },
  {
    id: "diagonal",
    label: "خط‌های مورب",
    preview: "bg-slate-800 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.15)_0px,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_8px)]",
  },
  { id: "monochrome", label: "سرمه‌ای تک‌رنگ", preview: "bg-slate-900" },
];

// ✅ NEW: نگاشت اندازه‌ی فونت انتخاب‌شده به کلاس متن
const FONT_SIZE_CLASSES = {
  small: "text-xs",
  medium: "text-sm",
  large: "text-base",
};

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    sendMessage: storeSendMessage,
    editMessage,
    deleteMessage,
    pinnedMessageId,
    togglePinMessage,
    votePoll,
    // ✅ NEW
    blockStatus,
    markMessagesRead,
  } = useChatStore();

  const { authUser } = useAuthStore();
  // ✅ NEW: پس‌زمینه‌ی چت + اندازه‌ی فونت از تنظیمات
  const { chatWallpaper, fontSize } = useSettingsStore();
  const wallpaperClass = WALLPAPER_CLASSES[chatWallpaper] || "";

  const messageEndRef = useRef(null);

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [text, setText] = useState("");

  // ✅ NEW: منوی کامل پیام (ریپلای/فوروارد/کپی/استار/پین/اطلاعات/ترجمه/ادیت/دیلیت)
  const [activeMenuData, setActiveMenuData] = useState(null); // { msg, senderName, isOwner, position }
  const [replyTarget, setReplyTarget] = useState(null); // { id, text, senderName }
  // ⚠️ استار و پین فعلاً فقط local هستن (با رفرش پاک می‌شن) چون بک‌اند
  // فیلدی براشون نداره
  const [starredIds, setStarredIds] = useState(new Set());
  const [forwardMessage, setForwardMessage] = useState(null);
  const [infoMessageData, setInfoMessageData] = useState(null);

  // ✅ NEW: برای long-press واقعی روی موبایل
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    if (!selectedUser) return;
    getMessagesByUserId();
    subscribeToMessages(selectedUser._id);
    return () => unsubscribeFromMessages();
  }, [selectedUser]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // ✅ NEW: هر وقت پیام‌های دریافتیِ خونده‌نشده روی صفحه ظاهر شدن، به سرور می‌گیم
  // خونده شدن — همین باعث تیک آبی سمت فرستنده می‌شه
  useEffect(() => {
    if (!selectedUser || !authUser?.id) return;
    const unreadIncomingIds = messages
      .filter(
        (m) =>
          !m.isOptimistic &&
          m.senderId !== null &&
          String(m.receiverId) === String(authUser.id) &&
          !m.isRead
      )
      .map((m) => m._id);

    if (unreadIncomingIds.length > 0) {
      markMessagesRead(unreadIncomingIds);
    }
  }, [messages, selectedUser, authUser?.id]);

  if (!selectedUser) return null;

  const isBlockedEitherWay = blockStatus.iBlockedThem || blockStatus.theyBlockedMe;

  // -------------------------
  // ✅ NEW: ارسال پیام + تزریق replyTo (اگه در حال ریپلای بودیم)
  // -------------------------
  const handleSendMessage = async (payload) => {
    await storeSendMessage({
      ...payload,
      replyTo: replyTarget
        ? { id: replyTarget.id, text: replyTarget.text, senderName: replyTarget.senderName }
        : null,
    });
    setReplyTarget(null);
  };

  // -------------------------
  // ✅ NEW: کپی متن پیام
  // -------------------------
  const handleCopy = (msg) => {
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text).then(
      () => toast.success("متن کپی شد"),
      () => toast.error("کپی ممکن نشد")
    );
  };

  // -------------------------
  // ✅ NEW: استار (local — فقط تا رفرش بعدی می‌مونه)
  // -------------------------
  const toggleStar = (msg) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(msg._id)) next.delete(msg._id);
      else next.add(msg._id);
      return next;
    });
  };

  // -------------------------
  // ✅ ترجمه با MyMemory (رایگان، بدون نیاز به API key) — جهت رو با
  // تشخیص حروف فارسی خودکار تعیین می‌کنه
  // -------------------------
  const handleTranslate = async (msg) => {
    if (!msg.text) return;
    const loadingToast = toast.loading("در حال ترجمه...");
    try {
      const hasPersian = /[\u0600-\u06FF]/.test(msg.text);
      const langpair = hasPersian ? "fa|en" : "en|fa";
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(msg.text)}&langpair=${langpair}`
      );
      if (!res.ok) throw new Error("translate failed");
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (!translated) throw new Error("empty translation");
      toast.dismiss(loadingToast);
      toast(
        (t) => (
          <div className="text-sm">
            <p className="font-medium mb-1 text-cyan-400">ترجمه:</p>
            <p className="text-slate-100">{translated}</p>
          </div>
        ),
        { duration: 8000, style: { background: "#1e293b", color: "#fff", border: "1px solid #334155" } }
      );
    } catch (err) {
      console.error("خطای ترجمه:", err);
      toast.dismiss(loadingToast);
      toast.error("ترجمه ممکن نشد — دوباره امتحان کن");
    }
  };

  // -------------------------
  // ✅ NEW: باز کردن منوی پیام — از کلیک ساده، کلیک راست، و long-press
  // موبایل (contextmenu / تایمر تاچ) صدا زده می‌شه
  // -------------------------
  const openMessageMenu = (e, msg, senderName, isOwner) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    const position = {
      top: Math.min(clientY, window.innerHeight - 340),
      left: Math.min(clientX, window.innerWidth - 200),
    };
    setActiveMenuData((prev) => (prev?.msg._id === msg._id ? null : { msg, senderName, isOwner, position }));
  };

  const handleBubbleClick = (e, msg, senderName, isOwner) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    openMessageMenu(e, msg, senderName, isOwner);
  };

  const handleTouchStart = (e, msg, senderName, isOwner) => {
    longPressTriggeredRef.current = false;
    const touch = e.touches[0];
    if (!touch) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openMessageMenu({ clientX: touch.clientX, clientY: touch.clientY }, msg, senderName, isOwner);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  // ✅ رندر نظرسنجی (سؤال + گزینه‌ها با نوار درصد رأی)
  const renderPoll = (msg) => {
    const { question, options = [], multiple } = msg.meta || {};
    const totalVotes = options.reduce((sum, o) => sum + (o.voters?.length || 0), 0);

    return (
      <div className="min-w-[220px]">
        <p className="font-medium mb-2">{question}</p>
        <div className="space-y-1.5">
          {options.map((opt) => {
            const voteCount = opt.voters?.length || 0;
            const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const hasVoted = opt.voters?.includes(authUser?.id);

            return (
              <button
                key={opt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  votePoll(msg._id, opt.id);
                }}
                className="w-full text-right relative overflow-hidden rounded-lg bg-black/20 hover:bg-black/30 transition-colors p-2"
              >
                <div className="absolute inset-y-0 right-0 bg-cyan-400/20" style={{ width: `${percent}%` }} />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-sm flex items-center gap-1.5">
                    {hasVoted && <CheckIcon className="w-3.5 h-3.5 text-cyan-300" />}
                    {opt.text}
                  </span>
                  <span className="text-xs opacity-70 flex-shrink-0">{percent}%</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs opacity-60 mt-1.5">
          {totalVotes} رأی {multiple ? "· چند انتخابی" : ""}
        </p>
      </div>
    );
  };

  // ✅ محتوای پیام بسته به نوعش
  const renderMessageContent = (msg) => {
    const type = msg.messageType || "text";

    if (type === "poll" && msg.meta?.options) {
      return renderPoll(msg);
    }

    if (type === "location" && msg.meta?.lat) {
      const mapUrl = `https://www.google.com/maps?q=${msg.meta.lat},${msg.meta.lng}`;
      return (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg p-2 transition-colors"
        >
          <MapPinIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">مشاهده لوکیشن روی نقشه</span>
        </a>
      );
    }

    if (type === "contact" && msg.meta?.name) {
      return (
        <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
            <img
              src={msg.meta.image || "/avatar.png"}
              alt={msg.meta.name}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{msg.meta.name}</p>
            {msg.meta.email && <p className="text-xs opacity-70 truncate">{msg.meta.email}</p>}
          </div>
        </div>
      );
    }

    // ✅ NEW: پیام صوتی — پلیر audio ساده
    if (type === "voice" && msg.file) {
      return (
        <audio controls preload="metadata" src={resolveUrl(msg.file)} className="max-w-[240px] h-9" />
      );
    }

    // ✅ NEW: پیام ویدیویی دایره‌ای (مثل تلگرام) — پلیر video گرد
    if (type === "video_note" && msg.file) {
      return (
        <video
          controls
          preload="metadata"
          src={resolveUrl(msg.file)}
          className="w-48 h-48 rounded-full object-cover bg-black"
        />
      );
    }

    if (type === "file" && msg.file) {
    return (
        <a
            href={resolveUrl(msg.file)}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg p-2 transition-colors"
        >
            <FileTextIcon className="w-5 h-5 flex-shrink-0" />

            <span className="text-sm truncate max-w-[180px]">
                {msg.fileName || "فایل"}
            </span>

            <DownloadIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
            </a>
        );
    }

    return null;
  };

  return (
    <>
      <ChatHeader />

      {/* ✅ NEW: پس‌زمینه‌ی چت از تنظیمات اعمال می‌شه */}
      <div className={`flex-1 px-6 overflow-y-auto py-8 ${wallpaperClass}`}>
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder
            name={selectedUser.name}
            onQuickReply={(msg) => {
              setText(msg);
              setEditingMessageId(null);
              setEditingText("");
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ✅ NEW: نوار پیام پین‌شده (local — تا رفرش بعدی) */}
            {pinnedMessageId &&
              (() => {
                const pinnedMsg = messages.find((m) => m._id === pinnedMessageId);
                if (!pinnedMsg) return null;
                return (
                  <div className="flex items-center gap-2 bg-slate-800/70 border border-cyan-500/30 rounded-lg px-3 py-2">
                    <Pin className="w-4 h-4 text-cyan-400 flex-shrink-0 fill-cyan-400" />
                    <p className="text-slate-300 text-xs truncate flex-1">{pinnedMsg.text || "پیام پین‌شده"}</p>
                    <button
                      onClick={() => togglePinMessage(pinnedMsg._id)}
                      className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}

            {messages.map((msg) => {
              if (msg.senderId === null) {
                return (
                  <div key={msg._id} className="text-center text-gray-400 italic my-2">
                    {msg.text}
                  </div>
                );
              }

              const isOwner = String(msg.senderId) === String(authUser?.id);
              const specialContent = renderMessageContent(msg);
              const senderName = isOwner ? authUser?.name || "شما" : selectedUser?.name;
              // ✅ NEW: وضعیت تیک این پیام
              const tickStatus = msg.isOptimistic ? "sending" : msg.isRead ? "read" : "sent";

              return (
                <div key={msg._id} className={`chat ${isOwner ? "chat-end" : "chat-start"}`}>
                  <div
                    className={`chat-bubble relative select-none ${
                      isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"
                    }`}
                    style={{ touchAction: "manipulation" }}
                    onClick={(e) => {
                      if (msg.messageType === "poll") return;
                      handleBubbleClick(e, msg, senderName, isOwner);
                    }}
                    onContextMenu={(e) => {
                      if (msg.messageType === "poll") return;
                      openMessageMenu(e, msg, senderName, isOwner);
                    }}
                    onTouchStart={(e) => {
                      if (msg.messageType === "poll") return;
                      handleTouchStart(e, msg, senderName, isOwner);
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    {msg.replyTo && (
                      <div className="mb-1.5 border-r-2 border-cyan-300/60 bg-black/15 rounded px-2 py-1">
                        <p className="text-[11px] text-cyan-200 font-medium">{msg.replyTo.senderName || "پیام"}</p>
                        <p className="text-[11px] opacity-80 truncate max-w-[220px]">{msg.replyTo.text}</p>
                      </div>
                    )}

                    {msg.image && (
                      <div className="mt-1">
                        <img
                          src={
                            msg.image.startsWith("data:image")
                              ? msg.image
                              : msg.image.startsWith("http")
                              ? msg.image
                              : `${API_BASE_URL}${msg.image}`
                          }
                          alt="Shared"
                          className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              msg.image.startsWith("http") ? msg.image : `${API_BASE_URL}${msg.image}`,
                              "_blank"
                            );
                          }}
                        />
                      </div>
                    )}

                    {specialContent && <div className="mt-1">{specialContent}</div>}

                    {msg.text && <p className="mt-2 whitespace-pre-wrap break-words">{msg.text}</p>}

                    <p className="text-xs mt-1 opacity-75 flex items-center gap-1 justify-end">
                      {starredIds.has(msg._id) && (
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      )}
                      {msg.createdAt instanceof Date
                        ? msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "🕒"}
                      {/* ✅ NEW: تیک وضعیت پیام (فقط برای پیام‌های خودت) */}
                      <MessageTicks isOwn={isOwner} status={tickStatus} />
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      {/* ✅ NEW: اگه یکی از دو طرف دیگری رو بلاک کرده، به‌جای اینپوت پیام یه نوار توضیحی نشون داده می‌شه */}
      {isBlockedEitherWay ? (
        <div className="border-t border-slate-700/50 bg-slate-800/60 px-6 py-4 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Ban className="w-4 h-4 flex-shrink-0" />
          {blockStatus.iBlockedThem
            ? "این کاربر را مسدود کرده‌اید. برای ارسال پیام، از منوی بالا مسدودیت را بردارید."
            : "امکان ارسال پیام به این کاربر وجود ندارد."}
        </div>
      ) : (
        <MessageInput
          text={text}
          setText={setText}
          editingMessageId={editingMessageId}
          editingText={editingText}
          setEditingMessageId={setEditingMessageId}
          setEditingText={setEditingText}
          sendMessage={handleSendMessage}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
        />
      )}

      {/* ✅ NEW: منوی کامل پیام + مودال‌های فوروارد و اطلاعات */}
      <MessageContextMenu
        isOpen={!!activeMenuData}
        onClose={() => setActiveMenuData(null)}
        position={activeMenuData?.position}
        isOwner={activeMenuData?.isOwner}
        hasText={!!activeMenuData?.msg?.text?.trim()}
        isStarred={activeMenuData ? starredIds.has(activeMenuData.msg._id) : false}
        isPinned={activeMenuData ? pinnedMessageId === activeMenuData.msg._id : false}
        onReply={() =>
          setReplyTarget({
            id: activeMenuData.msg._id,
            text:
              activeMenuData.msg.text ||
              (activeMenuData.msg.image
                ? "عکس"
                : activeMenuData.msg.file
                ? activeMenuData.msg.fileName || "فایل"
                : ""),
            senderName: activeMenuData.senderName,
          })
        }
        onForward={() => setForwardMessage(activeMenuData.msg)}
        onCopy={activeMenuData?.msg?.text ? () => handleCopy(activeMenuData.msg) : undefined}
        onToggleStar={() => toggleStar(activeMenuData.msg)}
        onTogglePin={() => togglePinMessage(activeMenuData.msg._id)}
        onTranslate={activeMenuData?.msg?.text ? () => handleTranslate(activeMenuData.msg) : undefined}
        onInfo={() => setInfoMessageData({ msg: activeMenuData.msg, senderName: activeMenuData.senderName })}
        onEdit={
          activeMenuData?.isOwner && activeMenuData?.msg?.text
            ? () => {
                setEditingMessageId(activeMenuData.msg._id);
                setEditingText(activeMenuData.msg.text);
                setText(activeMenuData.msg.text);
              }
            : undefined
        }
        onDelete={activeMenuData?.isOwner ? () => deleteMessage(activeMenuData.msg._id) : undefined}
      />

      <ForwardMessageModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />

      <MessageInfoModal isOpen={!!infoMessageData} onClose={() => setInfoMessageData(null)} data={infoMessageData} />
    </>
  );
}

export default ChatContainer;