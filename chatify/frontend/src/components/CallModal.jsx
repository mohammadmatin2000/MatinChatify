import { useEffect, useRef, useState } from "react";
import {
  PhoneIcon,
  PhoneOffIcon,
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  Minimize2Icon,
  UserPlusIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import useTranslation from "../hooks/useTranslation";
import { API_URL } from "../lib/apiConfig";
const API_BASE_URL = API_URL;

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ✅ NEW: مودال انتخاب مخاطب برای افزودن به تماس فعلی
function AddParticipantModal({ isOpen, onClose, excludeIds }) {
  const { allContacts, getAllContacts } = useChatStore();
  const { authUser } = useAuthStore();
  const { addParticipant } = useCallStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) getAllContacts();
  }, [isOpen, getAllContacts]);

  if (!isOpen) return null;

  const excludeSet = new Set((excludeIds || []).map(String));

  const handlePick = (contact) => {
    const contactId = contact._id || contact.id;
    const profilePic = contact.profile?.startsWith("http")
      ? contact.profile
      : contact.raw?.profile?.startsWith("http")
      ? contact.raw.profile
      : contact.raw?.profile
      ? `${API_BASE_URL}${contact.raw.profile}`
      : "/avatar.png";

    addParticipant(
      { id: contactId, name: contact.name, image: profilePic },
      { name: authUser?.name || authUser?.email, image: authUser?.image }
    );
    onClose();
  };

  const availableContacts = allContacts.filter((c) => !excludeSet.has(String(c._id || c.id)));

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
          <h3 className="text-slate-100 font-semibold text-base">{t("call.addToCall")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {availableContacts.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">{t("call.noMoreContacts")}</p>
          ) : (
            availableContacts.map((c) => {
              const profilePic = c.profile?.startsWith("http")
                ? c.profile
                : c.raw?.profile?.startsWith("http")
                ? c.raw.profile
                : c.raw?.profile
                ? `${API_BASE_URL}${c.raw.profile}`
                : "/avatar.png";
              return (
                <button
                  key={c._id || c.id}
                  onClick={() => handlePick(c)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 text-right transition-colors"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                    <img
                      src={profilePic}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                  </div>
                  <span className="text-slate-200 text-sm truncate">{c.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CallModal() {
  const {
    callStatus,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    callConnectedAt,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
  } = useCallStore();

  const { setSelectedUser, setActiveTab, allContacts } = useChatStore();
  const { t } = useTranslation();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [elapsed, setElapsed] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (callType === "audio" && remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  useEffect(() => {
    if (callStatus !== "connected" || !callConnectedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - callConnectedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [callStatus, callConnectedAt]);

  useEffect(() => {
    if (callStatus === "idle") {
      setIsMinimized(false);
      setShowMoreMenu(false);
      setIsSpeakerOn(true);
      setShowAddParticipant(false);
    }
  }, [callStatus]);

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) remoteAudioRef.current.volume = next ? 1 : 0.15;
      if (remoteVideoRef.current) remoteVideoRef.current.volume = next ? 1 : 0.15;
      return next;
    });
  };

  const handleOpenChat = () => {
    if (!remoteUser) return;
    const matchedContact = allContacts?.find((c) => String(c._id) === String(remoteUser.id));
    setSelectedUser(
      matchedContact || {
        _id: remoteUser.id,
        name: remoteUser.name,
        profile: remoteUser.image,
      }
    );
    setActiveTab("chats");
    setIsMinimized(true);
  };

  const handleAddParticipant = () => {
    if (callStatus !== "connected" && callStatus !== "calling") return;
    setShowAddParticipant(true);
  };

  if (callStatus === "idle") return null;

  const remoteImage = remoteUser?.image || "/avatar.png";
  const remoteName = remoteUser?.name || t("common.user");
  const canAddParticipant = callStatus === "connected" || callStatus === "calling";

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 left-5 z-[220] flex items-center gap-3 bg-slate-900/95 backdrop-blur-md
                   border border-slate-700/60 rounded-2xl shadow-2xl px-3 py-2 cursor-pointer
                   hover:border-cyan-500/40 transition-colors"
        dir="rtl"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-cyan-500/40 flex-shrink-0">
          <img src={remoteImage} alt={remoteName} className="w-full h-full object-cover" onError={(e) => (e.target.src = "/avatar.png")} />
        </div>
        <div className="min-w-0">
          <p className="text-slate-100 text-xs font-semibold truncate max-w-[110px]">{remoteName}</p>
          <p className="text-slate-400 text-[11px]">
            {callStatus === "connected" ? formatElapsed(elapsed) : t("call.calling")}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall(true);
          }}
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center flex-shrink-0"
          title={t("call.end")}
        >
          <PhoneOffIcon className="w-4 h-4 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden" dir="rtl">
      {callType === "audio" && <audio ref={remoteAudioRef} autoPlay />}

      <div className="absolute inset-0 -z-10">
        <img src={remoteImage} alt="" className="w-full h-full object-cover blur-2xl scale-110 opacity-40" onError={(e) => (e.target.style.display = "none")} />
        <div className="absolute inset-0 bg-slate-950/80" />
      </div>

      <div className="flex items-center justify-between px-5 pt-5">
        <button
          onClick={() => setIsMinimized(true)}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          title={t("call.minimize")}
        >
          <Minimize2Icon className="w-[18px] h-[18px] text-white" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="text-slate-100 text-base font-semibold">{remoteName}</h2>
          <p className="text-slate-300 text-xs mt-0.5">
            {callStatus === "calling" && t("call.calling")}
            {callStatus === "ringing" && t("call.ringingIncoming")}
            {callStatus === "connected" && formatElapsed(elapsed)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddParticipant}
            disabled={!canAddParticipant}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 flex items-center justify-center transition-colors"
            title={t("member.add")}
          >
            <UserPlusIcon className="w-[18px] h-[18px] text-white" />
          </button>
          <button
            onClick={handleOpenChat}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title={t("call.sendMessage")}
          >
            <MessageCircleIcon className="w-[18px] h-[18px] text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        {callType === "video" && callStatus === "connected" ? (
          <div className="relative w-full max-w-3xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-3 left-3 w-28 h-20 rounded-lg object-cover ring-2 ring-slate-700"
            />
          </div>
        ) : (
          <div className="w-36 h-36 rounded-full overflow-hidden ring-4 ring-white/10 shadow-2xl">
            <img
              src={remoteImage}
              alt={remoteName}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 pb-8 px-6">
        {callStatus === "ringing" ? (
          <div className="flex items-center gap-6">
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
              title={t("call.reject")}
            >
              <PhoneOffIcon className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg"
              title={t("call.accept")}
            >
              <PhoneIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between bg-white/5 backdrop-blur-md rounded-full px-3 py-3">
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title={t("chatHeader.moreOptions")}
                >
                  <MoreHorizontalIcon className="w-5 h-5" />
                </button>
                {showMoreMenu && (
                  <div className="absolute bottom-14 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1.5 w-40 text-sm">
                    <button
                      onClick={() => {
                        toggleSpeaker();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 text-slate-200 hover:bg-slate-700/60 transition-colors"
                    >
                      {isSpeakerOn ? t("call.speakerDown") : t("call.speakerUp")}
                    </button>
                  </div>
                )}
              </div>

              {callType === "video" ? (
                <button
                  onClick={toggleCamera}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isCameraOff ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                  title={isCameraOff ? t("call.cameraOn") : t("call.cameraOff")}
                >
                  {isCameraOff ? <VideoOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                </button>
              ) : (
                <button
                  onClick={toggleSpeaker}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isSpeakerOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white text-slate-900"
                  }`}
                  title={isSpeakerOn ? t("call.speakerDown") : t("call.speakerUp")}
                >
                  {isSpeakerOn ? <Volume2Icon className="w-5 h-5" /> : <VolumeXIcon className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={toggleMic}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isMicMuted ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20 text-white"
                }`}
                title={isMicMuted ? t("call.micOn") : t("call.micOff")}
              >
                {isMicMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => endCall(true)}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
                title={t("call.end")}
              >
                <PhoneOffIcon className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddParticipantModal
        isOpen={showAddParticipant}
        onClose={() => setShowAddParticipant(false)}
        excludeIds={remoteUser ? [remoteUser.id] : []}
      />
    </div>
  );
}

export default CallModal;