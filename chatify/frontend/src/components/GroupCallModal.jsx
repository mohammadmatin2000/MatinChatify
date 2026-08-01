import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon, MicIcon, MicOffIcon, XIcon, UsersIcon } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";

const API_BASE_URL = "http://localhost:8000";
const resolveAvatar = (img) => {
  if (!img) return "/avatar.png";
  return img.startsWith("http") ? img : `${API_BASE_URL}${img}`;
};

// یه تایل که هم ویدیو هم صدا رو مدیریت می‌کنه.
// ✅ FIX: قبلاً وقتی showVideo=false بود (مثل تماس صوتی، یا دوربین طرف
// خاموش)، هیچ عنصر <audio>/<video> ای رندر نمی‌شد — یعنی صدا هم پخش
// نمی‌شد، چون هیچ عنصری به stream وصل نبود. الان توی اون حالت یه
// <audio> مخفی جدا صدا رو پخش می‌کنه.
function VideoTile({ stream, muted = false, name, image, showVideo = true }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const hasVideoTrack = !!stream?.getVideoTracks?.().some((t) => t.enabled);
  const showingVideoEl = showVideo && hasVideoTrack;

  useEffect(() => {
    if (showingVideoEl && videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream, showingVideoEl]);

  // ✅ FIX: وقتی <video> نشون داده نمی‌شه، صدا رو از طریق یه <audio> مخفی پخش کن
  useEffect(() => {
    if (!showingVideoEl && audioRef.current) {
      audioRef.current.srcObject = stream || null;
    }
  }, [stream, showingVideoEl]);

  return (
    <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-700/50">
      {showingVideoEl ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <>
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600">
            <img src={resolveAvatar(image)} alt={name} className="w-full h-full object-cover" onError={(e) => (e.target.src = "/avatar.png")} />
          </div>
          {/* ✅ NEW: عنصر صوتی مخفی — بدون این، هیچ صدایی از طرف مقابل شنیده نمی‌شد */}
          <audio ref={audioRef} autoPlay muted={muted} />
        </>
      )}
      <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-md">
        {name || "..."}
      </span>
    </div>
  );
}

function GroupCallModal() {
  const {
    groupCallStatus,
    groupCallType,
    activeGroupName,
    groupParticipants,
    localStream,
    isMicMuted,
    isCameraOff,
    toggleMic,
    toggleCamera,
    leaveGroupCall,
    groupCallInvite,
    joinInvitedGroupCall,
    dismissGroupCallInvite,
  } = useCallStore();

  const { authUser } = useAuthStore();

  // ---------- بنر دعوت به تماس گروهی (وقتی خودمون توی تماس نیستیم) ----------
  if (groupCallStatus === "idle" && groupCallInvite) {
    return createPortal(
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] w-[92%] max-w-sm">
        <div className="bg-slate-800 border border-cyan-500/40 rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
            <img
              src={resolveAvatar(groupCallInvite.fromImage)}
              alt={groupCallInvite.fromName}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-100 text-sm font-medium truncate">
              {groupCallInvite.groupName || "گروه"}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {groupCallInvite.fromName || "یکی از اعضا"} یه تماس {groupCallInvite.callType === "video" ? "تصویری" : "صوتی"} شروع کرد
            </p>
          </div>
          <button
            onClick={() =>
              joinInvitedGroupCall({
                name: authUser?.name || authUser?.email || "کاربر",
                image: authUser?.image || authUser?.profile || null,
              })
            }
            className="w-10 h-10 rounded-full bg-green-500/15 text-green-400 hover:bg-green-500/25 flex items-center justify-center transition-colors flex-shrink-0"
            title="پیوستن"
          >
            <PhoneIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={dismissGroupCallInvite}
            className="w-10 h-10 rounded-full bg-slate-700/60 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
            title="بستن"
          >
            <XIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        `}</style>
      </div>,
      document.body
    );
  }

  // ---------- خودِ صفحه‌ی تماس (وقتی داخل تماسیم) ----------
  if (groupCallStatus !== "in-call") return null;

  const participantList = Object.entries(groupParticipants);
  const isVideoCall = groupCallType === "video";

  return createPortal(
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col">
      {/* هدر */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-200">
          <UsersIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-sm">{activeGroupName || "تماس گروهی"}</span>
        </div>
        <span className="text-xs text-slate-500">
          {participantList.length + 1} نفر {isVideoCall ? "· تصویری" : "· صوتی"}
        </span>
      </div>

      {/* شبکه‌ی ویدیو/آواتار شرکت‌کننده‌ها */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
          <VideoTile
            stream={localStream}
            muted
            name={`${authUser?.name || "من"} (خودم)`}
            image={authUser?.image || authUser?.profile}
            showVideo={isVideoCall && !isCameraOff}
          />

          {participantList.map(([userId, p]) => (
            <VideoTile
              key={userId}
              stream={p.stream}
              name={p.name}
              image={p.image}
              showVideo={isVideoCall}
            />
          ))}
        </div>

        {participantList.length === 0 && (
          <p className="text-center text-slate-500 text-sm mt-8">
            منتظر پیوستن بقیه‌ی اعضا...
          </p>
        )}
      </div>

      {/* کنترل‌ها */}
      <div className="flex items-center justify-center gap-4 py-6 border-t border-slate-800">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicMuted ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
          title={isMicMuted ? "روشن کردن میکروفون" : "قطع میکروفون"}
        >
          {isMicMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
        </button>

        {isVideoCall && (
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isCameraOff ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
            title={isCameraOff ? "روشن کردن دوربین" : "خاموش کردن دوربین"}
          >
            {isCameraOff ? <VideoOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={leaveGroupCall}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          title="ترک تماس"
        >
          <PhoneOffIcon className="w-6 h-6" />
        </button>
      </div>
    </div>,
    document.body
  );
}

export default GroupCallModal;