import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PhoneIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  XIcon,
  UsersIcon,
  Minimize2Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import useTranslation from "../hooks/useTranslation";

const API_BASE_URL = "http://localhost:8000";
const resolveAvatar = (img) => {
  if (!img) return "/avatar.png";
  return img.startsWith("http") ? img : `${API_BASE_URL}${img}`;
};

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function VideoTile({ stream, muted = false, name, image, showVideo = true, speakerOn = true }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const hasVideoTrack = !!stream?.getVideoTracks?.().some((t) => t.enabled);
  const showingVideoEl = showVideo && hasVideoTrack;

  useEffect(() => {
    if (showingVideoEl && videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream, showingVideoEl]);

  useEffect(() => {
    if (!showingVideoEl && audioRef.current) {
      audioRef.current.srcObject = stream || null;
    }
  }, [stream, showingVideoEl]);

  useEffect(() => {
    const vol = speakerOn ? 1 : 0.15;
    if (videoRef.current) videoRef.current.volume = vol;
    if (audioRef.current) audioRef.current.volume = vol;
  }, [speakerOn, showingVideoEl]);

  return (
    <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-700/50">
      {showingVideoEl ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <>
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600">
            <img src={resolveAvatar(image)} alt={name} className="w-full h-full object-cover" onError={(e) => (e.target.src = "/avatar.png")} />
          </div>
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
  const { t } = useTranslation();

  const [elapsed, setElapsed] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const startedAtRef = useRef(null);

  useEffect(() => {
    if (groupCallStatus === "in-call") {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      const tick = () => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    } else {
      startedAtRef.current = null;
      setElapsed(0);
    }
  }, [groupCallStatus]);

  useEffect(() => {
    if (groupCallStatus === "idle") {
      setIsMinimized(false);
      setIsSpeakerOn(true);
    }
  }, [groupCallStatus]);

  if (groupCallStatus === "idle" && groupCallInvite) {
    const callTypeLabel = groupCallInvite.callType === "video" ? t("groupCall.videoType") : t("groupCall.audioType");
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
              {groupCallInvite.groupName || t("groupCall.groupFallback")}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {t("groupCall.invited", {
                name: groupCallInvite.fromName || t("groupCall.someoneFallback"),
                type: callTypeLabel,
              })}
            </p>
          </div>
          <button
            onClick={() =>
              joinInvitedGroupCall({
                name: authUser?.name || authUser?.email || t("common.user"),
                image: authUser?.image || authUser?.profile || null,
              })
            }
            className="w-10 h-10 rounded-full bg-green-500/15 text-green-400 hover:bg-green-500/25 flex items-center justify-center transition-colors flex-shrink-0"
            title={t("groupCall.join")}
          >
            <PhoneIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={dismissGroupCallInvite}
            className="w-10 h-10 rounded-full bg-slate-700/60 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
            title={t("common.close")}
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

  if (groupCallStatus !== "in-call") return null;

  const participantList = Object.entries(groupParticipants);
  const isVideoCall = groupCallType === "video";

  if (isMinimized) {
    return createPortal(
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 left-5 z-[270] flex items-center gap-3 bg-slate-900/95 backdrop-blur-md
                   border border-slate-700/60 rounded-2xl shadow-2xl px-3 py-2 cursor-pointer
                   hover:border-cyan-500/40 transition-colors"
        dir="rtl"
      >
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <UsersIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-100 text-xs font-semibold truncate max-w-[110px]">
            {activeGroupName || t("groupCall.fallbackName")}
          </p>
          <p className="text-slate-400 text-[11px]">{formatElapsed(elapsed)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            leaveGroupCall();
          }}
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center flex-shrink-0"
          title={t("groupCall.leave")}
        >
          <PhoneOffIcon className="w-4 h-4 text-white" />
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <button
          onClick={() => setIsMinimized(true)}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
          title={t("call.minimize")}
        >
          <Minimize2Icon className="w-4 h-4 text-slate-300" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-200">
            <UsersIcon className="w-4 h-4 text-cyan-400" />
            <span className="font-medium text-sm">{activeGroupName || t("groupCall.fallbackName")}</span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5">
            {formatElapsed(elapsed)} · {t("groupCall.peopleCount", { count: participantList.length + 1 })}{" "}
            · {isVideoCall ? t("groupCall.videoType") : t("groupCall.audioType")}
          </span>
        </div>

        <button
          onClick={() => setIsSpeakerOn((v) => !v)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            isSpeakerOn ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-white text-slate-900"
          }`}
          title={isSpeakerOn ? t("call.speakerDown") : t("call.speakerUp")}
        >
          {isSpeakerOn ? <Volume2Icon className="w-4 h-4" /> : <VolumeXIcon className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
          <VideoTile
            stream={localStream}
            muted
            name={`${authUser?.name || t("common.user")} ${t("group.you")}`}
            image={authUser?.image || authUser?.profile}
            showVideo={isVideoCall && !isCameraOff}
            speakerOn={isSpeakerOn}
          />

          {participantList.map(([userId, p]) => (
            <VideoTile
              key={userId}
              stream={p.stream}
              name={p.name}
              image={p.image}
              showVideo={isVideoCall}
              speakerOn={isSpeakerOn}
            />
          ))}
        </div>

        {participantList.length === 0 && (
          <p className="text-center text-slate-500 text-sm mt-8">{t("groupCall.waitingOthers")}</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-6 border-t border-slate-800">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicMuted ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
          title={isMicMuted ? t("call.micOn") : t("call.micOff")}
        >
          {isMicMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
        </button>

        {isVideoCall && (
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isCameraOff ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
            title={isCameraOff ? t("groupCall.cameraOff") : t("groupCall.cameraOn")}
          >
            {isCameraOff ? <VideoOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={leaveGroupCall}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          title={t("groupCall.leave")}
        >
          <PhoneOffIcon className="w-6 h-6" />
        </button>
      </div>
    </div>,
    document.body
  );
}

export default GroupCallModal;