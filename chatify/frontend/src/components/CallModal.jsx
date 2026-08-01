import { useEffect, useRef } from "react";
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import { useCallStore } from "../store/useCallStore";

function CallModal() {
  const {
    callStatus,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // وصل کردن استریم محلی (خودمون) به تگ ویدیو
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // وصل کردن استریم طرف مقابل به تگ ویدیو یا صدا
  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (callType === "audio" && remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  if (callStatus === "idle") return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-8" dir="rtl">
      {/* صدای طرف مقابل (برای تماس صوتی، چون تگ ویدیو نمایش داده نمیشه) */}
      {callType === "audio" && <audio ref={remoteAudioRef} autoPlay />}

      {/* بخش بالا: اطلاعات کاربر */}
      <div className="flex flex-col items-center gap-3 mt-10">
        <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-cyan-500/30">
          <img
            src={remoteUser?.image || "/avatar.png"}
            alt={remoteUser?.name}
            className="w-full h-full object-cover"
            onError={(e) => (e.target.src = "/avatar.png")}
          />
        </div>
        <h2 className="text-slate-100 text-xl font-semibold">{remoteUser?.name || "کاربر"}</h2>
        <p className="text-slate-400 text-sm">
          {callStatus === "calling" && "در حال تماس..."}
          {callStatus === "ringing" && "در حال تماس با شما..."}
          {callStatus === "connected" && (callType === "video" ? "تماس تصویری" : "تماس صوتی")}
        </p>
      </div>

      {/* بخش وسط: تصویر (فقط برای تماس تصویری و وضعیت متصل) */}
      {callType === "video" && callStatus === "connected" && (
        <div className="relative w-full max-w-2xl aspect-video bg-slate-900 rounded-2xl overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-3 left-3 w-28 h-20 rounded-lg object-cover ring-2 ring-slate-700"
          />
        </div>
      )}

      {/* بخش پایین: دکمه‌های کنترل */}
      <div className="flex items-center gap-5 mb-6">
        {callStatus === "ringing" ? (
          <>
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              title="رد تماس"
            >
              <PhoneOffIcon className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
              title="قبول تماس"
            >
              <PhoneIcon className="w-6 h-6 text-white" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isMicMuted ? "bg-slate-600" : "bg-slate-700 hover:bg-slate-600"
              }`}
              title={isMicMuted ? "روشن کردن میکروفون" : "قطع میکروفون"}
            >
              {isMicMuted ? (
                <MicOffIcon className="w-5 h-5 text-white" />
              ) : (
                <MicIcon className="w-5 h-5 text-white" />
              )}
            </button>

            {callType === "video" && (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isCameraOff ? "bg-slate-600" : "bg-slate-700 hover:bg-slate-600"
                }`}
                title={isCameraOff ? "روشن کردن دوربین" : "قطع دوربین"}
              >
                {isCameraOff ? (
                  <VideoOffIcon className="w-5 h-5 text-white" />
                ) : (
                  <VideoIcon className="w-5 h-5 text-white" />
                )}
              </button>
            )}

            <button
              onClick={() => endCall(true)}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              title="پایان تماس"
            >
              <PhoneOffIcon className="w-6 h-6 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CallModal;