import { XIcon, PhoneIcon, VideoIcon, ClockIcon, Quote } from "lucide-react";
import { API_URL } from "../lib/apiConfig";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import ChatHeaderMenu from "./ChatHeaderMenu";
import useTranslation from "../hooks/useTranslation";

import { useEffect, useState } from "react";

function ChatHeader() {
  const { selectedUser, setSelectedUser, onlineUsers, blockStatus } = useChatStore();
  const { startCall, callStatus } = useCallStore();
  const { t, language } = useTranslation();

  // فرمت «آخرین بازدید» — با ترجمه و locale بر اساس زبون فعلی اپ
  const dateLocaleStr = language === "fa" ? "fa-IR" : language === "de" ? "de-DE" : "en-US";

  // ✅ NEW: بیو ممکنه طولانی باشه — با کلیک باز/بسته می‌شه، و با عوض شدن
  // مخاطب دوباره بسته می‌شه تا حالت قبلی رو نبره روی چت جدید
  const [bioExpanded, setBioExpanded] = useState(false);

  const formatLastSeen = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString(dateLocaleStr, { hour: "2-digit", minute: "2-digit" });

    if (isToday) return t("lastSeen.today", { time });
    if (isYesterday) return t("lastSeen.yesterday", { time });

    const dateStr = date.toLocaleDateString(dateLocaleStr, { day: "numeric", month: "long" });
    return t("lastSeen.date", { date: dateStr });
  };

  const isOnline = selectedUser
    ? onlineUsers.some((id) => String(id) === String(selectedUser.id || selectedUser._id))
    : false;

  const selectedUserKey = selectedUser?.id || selectedUser?._id || null;

  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") {
        setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", esc);

    return () => window.removeEventListener("keydown", esc);
  }, [setSelectedUser]);

  // ✅ NEW: هر بار چت عوض شد، حالت باز/بسته‌ی بیو ریست بشه
  useEffect(() => {
    setBioExpanded(false);
  }, [selectedUserKey]);

  if (!selectedUser) return null;

  const profilePic = selectedUser.profile?.startsWith("http")
    ? selectedUser.profile
    : selectedUser.raw?.profile?.startsWith("http")
    ? selectedUser.raw.profile
    : selectedUser.raw?.profile
    ? `${API_URL}${selectedUser.raw.profile}`
    : "/avatar.png";

  const isBlockedEitherWay = blockStatus.iBlockedThem || blockStatus.theyBlockedMe;
  const canCall = callStatus === "idle" && !isBlockedEitherWay;

  // آخرین بازدید از raw.last_seen (که سریالایزر/سوکت مخاطبین برمی‌گردونه)
  const lastSeenText = !isOnline
    ? formatLastSeen(selectedUser.raw?.last_seen || selectedUser.last_seen)
    : null;

  // بیوگرافی طرف مقابل — سرور فقط وقتی مقدار می‌فرسته که about_visibility
  // طرف اجازه بده؛ اگه خودش خاموشش کرده باشه، همیشه null‌ه و چیزی نشون داده نمی‌شه
  const bioText = selectedUser.raw?.bio || selectedUser.bio || null;

  const handleAudioCall = () => {
    if (!canCall) return;
    startCall(
      { id: selectedUser.id || selectedUser._id, name: selectedUser.name, image: profilePic },
      "audio"
    );
  };

  const handleVideoCall = () => {
    if (!canCall) return;
    startCall(
      { id: selectedUser.id || selectedUser._id, name: selectedUser.name, image: profilePic },
      "video"
    );
  };

  return (
    <div className="flex justify-between items-start bg-slate-800/50 border-b border-slate-700/50 px-6 py-3 min-h-[84px]">
      <div className="flex items-start gap-3 min-w-0">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
            <img
              src={profilePic}
              alt={selectedUser.name}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>

          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
              isOnline ? "bg-green-500" : "bg-gray-500"
            }`}
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-slate-100 font-medium truncate">{selectedUser.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {blockStatus.iBlockedThem ? (
              <span className="text-xs text-red-400/90">{t("chatHeader.blocked")}</span>
            ) : blockStatus.theyBlockedMe ? (
              <span className="text-xs text-red-400/90">{t("chatHeader.cannotMessage")}</span>
            ) : isOnline ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                {t("common.online")}
              </span>
            ) : lastSeenText ? (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <ClockIcon className="w-3 h-3" />
                {lastSeenText}
              </span>
            ) : (
              <span className="text-xs text-slate-500">{t("common.offline")}</span>
            )}
          </div>

          {/* ✅ NEW: بیو — قابل کلیک برای باز شدن کامل، فقط وقتی سرور مقداری برگردونده باشه */}
          {bioText && (
            <button
              type="button"
              onClick={() => setBioExpanded((v) => !v)}
              className="group/bio flex items-start gap-1.5 mt-1.5 text-right max-w-[280px] cursor-pointer"
              title={bioExpanded ? "" : "برای دیدن کامل کلیک کن"}
            >
              <Quote className="w-3 h-3 mt-[3px] text-cyan-500/60 flex-shrink-0 group-hover/bio:text-cyan-400 transition-colors" />
              <span
                className={`text-[11.5px] leading-relaxed text-slate-400 group-hover/bio:text-slate-300 transition-colors ${
                  bioExpanded ? "whitespace-pre-wrap break-words" : "truncate block"
                }`}
              >
                {bioText}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <button
          onClick={handleAudioCall}
          disabled={!canCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-cyan-500/10 text-cyan-400
                     hover:bg-cyan-500/20 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-cyan-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title={t("chatHeader.audioCall")}
        >
          <PhoneIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        <button
          onClick={handleVideoCall}
          disabled={!canCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-violet-500/10 text-violet-400
                     hover:bg-violet-500/20 hover:shadow-[0_0_16px_rgba(167,139,250,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-violet-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title={t("chatHeader.videoCall")}
        >
          <VideoIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        <span className="w-px h-6 bg-slate-700/60 mx-1" />

        <ChatHeaderMenu userId={selectedUser.id || selectedUser._id} userName={selectedUser.name} />

        <button
          onClick={() => setSelectedUser(null)}
          className="group w-10 h-10 rounded-full flex items-center justify-center
                     text-slate-400 hover:text-slate-100 hover:bg-slate-700/50
                     active:scale-90 transition-all duration-200"
          title={t("chatHeader.closeChat")}
        >
          <XIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:rotate-90" />
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;