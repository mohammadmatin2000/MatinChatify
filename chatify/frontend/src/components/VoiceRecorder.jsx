import { useRef, useState, useEffect, useCallback } from "react";
import { MicIcon, VideoIcon, TrashIcon, LockIcon } from "lucide-react";
import useTranslation from "../hooks/useTranslation";

const CANCEL_THRESHOLD = 80;
const LOCK_THRESHOLD = 60;

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function VoiceRecorder({ onSend, disabled = false }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const cancelledRef = useRef(false);
  const videoPreviewNodeRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const attachVideoPreview = useCallback((node) => {
    videoPreviewNodeRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);

  const startRecording = async (clientX, clientY) => {
    if (disabled || isRecordingRef.current) return;
    isRecordingRef.current = true;

    try {
      const constraints =
        mode === "video_note"
          ? { audio: true, video: { width: 320, height: 320, facingMode: "user" } }
          : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mode === "video_note") {
        setShowVideoPreview(true);
        if (videoPreviewNodeRef.current) {
          videoPreviewNodeRef.current.srcObject = stream;
        }
      }

      const mimeType = mode === "video_note" ? "video/webm" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();
        setShowVideoPreview(false);

        if (cancelledRef.current) {
          chunksRef.current = [];
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size > 500) {
          onSend(blob, mode === "video_note" ? "video_note" : "voice");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      setIsRecording(true);
      setIsLocked(false);
      setDuration(0);
      startXRef.current = clientX;
      startYRef.current = clientY;
      setDragX(0);
      setDragY(0);

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("خطا در دسترسی به میکروفون/دوربین:", err);
      alert(t("voice.accessFailed"));
      isRecordingRef.current = false;
    }
  };

  const finishRecording = (cancelled = false) => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    cancelledRef.current = cancelled;

    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsLocked(false);
    setDragX(0);
    setDragY(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleMove = useCallback(
    (clientX, clientY) => {
      if (!isRecordingRef.current || isLocked) return;

      const deltaX = startXRef.current - clientX;
      const deltaY = startYRef.current - clientY;

      if (deltaY > LOCK_THRESHOLD) {
        setIsLocked(true);
        setDragX(0);
        setDragY(0);
        return;
      }

      if (deltaX > 0) {
        setDragX(Math.min(deltaX, CANCEL_THRESHOLD + 20));
      }

      if (deltaX > CANCEL_THRESHOLD) {
        finishRecording(true);
      }
    },
    [isLocked]
  );

  useEffect(() => {
    if (!isRecording) return;

    const onPointerMove = (e) => handleMove(e.clientX, e.clientY);
    const onPointerUp = () => {
      if (!isLocked) finishRecording(false);
    };
    const onPointerCancel = () => {
      if (!isLocked) finishRecording(true);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [isRecording, isLocked, handleMove]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    startRecording(e.clientX, e.clientY);
  };

  const toggleMode = () => {
    if (isRecording) return;
    setMode((prev) => (prev === "voice" ? "video_note" : "voice"));
  };

  if (isRecording) {
    const cancelOpacity = Math.max(0, 1 - dragX / CANCEL_THRESHOLD);
    const isVideoMode = mode === "video_note" && showVideoPreview;

    return (
      <div className="flex items-center gap-3 flex-1 relative">
        {isVideoMode && (
          <div className="fixed bottom-[92px] left-1/2 -translate-x-1/2 z-[150] pointer-events-none">
            <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full overflow-hidden ring-4 ring-cyan-500/50 shadow-2xl bg-slate-900">
              <video
                ref={attachVideoPreview}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-slate-200 text-sm font-medium tabular-nums flex-shrink-0">
            {formatDuration(duration)}
          </span>

          {!isLocked ? (
            <div className="flex-1 flex items-center justify-center gap-1 text-slate-400 text-xs" style={{ opacity: cancelOpacity }}>
              <span>{t("voice.dragToCancel")}</span>
              <TrashIcon className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {isLocked ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => finishRecording(true)}
              className="w-9 h-9 rounded-full bg-slate-700 hover:bg-red-500/80 flex items-center justify-center transition-colors flex-shrink-0"
              title={t("voice.cancel")}
            >
              <TrashIcon className="w-4 h-4 text-slate-200" />
            </button>
            <button
              type="button"
              onClick={() => finishRecording(false)}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 flex items-center justify-center transition-all flex-shrink-0"
              title={t("common.send")}
            >
              {isVideoMode ? <VideoIcon className="w-5 h-5 text-white" /> : <MicIcon className="w-5 h-5 text-white" />}
            </button>
          </div>
        ) : (
          <div className="relative flex-shrink-0">
            <div className="absolute -top-16 right-1/2 translate-x-1/2 flex flex-col items-center gap-1 text-slate-400">
              <LockIcon className="w-4 h-4" />
              <div className="w-px h-6 bg-slate-600" />
            </div>
            <button
              type="button"
              style={{ transform: `translateX(${-dragX}px)` }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                dragX > CANCEL_THRESHOLD * 0.6
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-cyan-500 to-cyan-600"
              }`}
            >
              {isVideoMode ? <VideoIcon className="w-5 h-5 text-white" /> : <MicIcon className="w-5 h-5 text-white" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      <button
        type="button"
        onClick={toggleMode}
        className="rounded-lg px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white flex items-center justify-center transition-all flex-shrink-0"
        title={mode === "voice" ? t("voice.switchToVideo") : t("voice.switchToVoice")}
      >
        {mode === "voice" ? <VideoIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
      </button>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        disabled={disabled}
        className="rounded-lg px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
        title={mode === "voice" ? t("voice.holdToTalk") : t("voice.holdToFilm")}
      >
        {mode === "voice" ? <MicIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
      </button>
    </div>
  );
}

export default VoiceRecorder;