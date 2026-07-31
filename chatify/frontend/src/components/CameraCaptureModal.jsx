import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { XIcon, CameraIcon, SendIcon, RefreshCwIcon, SwitchCameraIcon } from "lucide-react";

// دوربین واقعی داخل اپ — با getUserMedia استریم زنده می‌گیره، عکس رو
// روی canvas می‌کشه و به‌صورت File برمی‌گردونه. دقیقاً رفتار واتساب:
// پیش‌نمایش زنده → گرفتن عکس → دوباره‌بگیر یا ارسال.
function CameraCaptureModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null); // { blob, url }
  const [facingMode, setFacingMode] = useState("environment");
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("خطا در دسترسی به دوربین:", err);
      setError("دسترسی به دوربین ممکن نشد. مطمئن شو مجوز دوربین رو به مرورگر دادی.");
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, stopStream]);

  // باز شدن مودال یا تعویض دوربین جلو/عقب → استریم رو (دوباره) راه بنداز
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedImage(null);
      return;
    }
    startStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode]);

  // آزاد کردن حافظه‌ی URL موقتی عکس گرفته‌شده
  useEffect(() => {
    return () => {
      if (capturedImage?.url) URL.revokeObjectURL(capturedImage.url);
    };
  }, [capturedImage]);

  if (!isOpen) return null;

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedImage({ blob, url });
        stopStream(); // بعد از گرفتن عکس، دوربین رو خاموش کن تا چراغش نسوزه
      },
      "image/jpeg",
      0.92
    );
  };

  const handleRetake = () => {
    if (capturedImage?.url) URL.revokeObjectURL(capturedImage.url);
    setCapturedImage(null);
    startStream();
  };

  const handleSend = () => {
    if (!capturedImage) return;
    const file = new File([capturedImage.blob], `camera-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    handleClose();
  };

  const handleClose = () => {
    stopStream();
    if (capturedImage?.url) URL.revokeObjectURL(capturedImage.url);
    setCapturedImage(null);
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* هدر شناور */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-10">
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white"
          title="بستن"
        >
          <XIcon className="w-5 h-5" />
        </button>
        {!capturedImage && !error && (
          <button
            onClick={toggleFacingMode}
            className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white"
            title="تعویض دوربین"
          >
            <SwitchCameraIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* محتوای اصلی: استریم زنده یا عکسِ گرفته‌شده */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center text-slate-300 px-6">
            <CameraIcon className="w-10 h-10 mx-auto mb-3 text-slate-500" />
            <p className="text-sm">{error}</p>
            <button
              onClick={startStream}
              className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm text-white transition-colors"
            >
              تلاش دوباره
            </button>
          </div>
        ) : capturedImage ? (
          <img src={capturedImage.url} alt="عکس گرفته‌شده" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}

        {isStarting && !error && !capturedImage && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            در حال روشن کردن دوربین...
          </div>
        )}
      </div>

      {/* کنترل‌های پایین */}
      <div className="px-6 py-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-10">
        {capturedImage ? (
          <>
            <button onClick={handleRetake} className="flex flex-col items-center gap-1.5 text-white">
              <div className="w-14 h-14 rounded-full bg-slate-700/80 flex items-center justify-center">
                <RefreshCwIcon className="w-6 h-6" />
              </div>
              <span className="text-xs">دوباره بگیر</span>
            </button>
            <button onClick={handleSend} className="flex flex-col items-center gap-1.5 text-white">
              <div className="w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center transition-colors">
                <SendIcon className="w-6 h-6" />
              </div>
              <span className="text-xs">ارسال</span>
            </button>
          </>
        ) : (
          !error && (
            <button
              onClick={handleCapture}
              disabled={isStarting}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              title="گرفتن عکس"
            >
              <span className="w-12 h-12 rounded-full bg-white" />
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  );
}

export default CameraCaptureModal;