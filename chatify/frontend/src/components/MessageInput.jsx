import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useSettingsStore } from "../store/useSettingsStore"; // ✅ NEW
import { SendIcon, XIcon, FileTextIcon } from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import AttachMenu from "./AttachMenu";
import VoiceRecorder from "./VoiceRecorder";

export default function MessageInput({
  text,
  setText,
  editingMessageId,
  editingText,
  setEditingMessageId,
  setEditingText,
  sendMessage: sendMessageProp, // ✅ اگه پاس داده بشه (گروه)، اولویت داره
  editMessage: editMessageProp, // ✅ همین‌طور برای ویرایش — اگه پاس داده
  // بشه (حالت گروه)، از این استفاده می‌شه؛ قبلاً همیشه editMessage چت
  // خصوصی از store صدا زده می‌شد، حتی توی گروه (که یعنی ویرایش پیام گروه
  // هیچ‌وقت واقعاً به سرور گروه نمی‌رفت).
  replyTarget = null, // { id, text, senderName } — وقتی از منوی پیام «ریپلای» زده بشه
  onCancelReply = () => {},
}) {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [imageFile, setImageFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const fileInputRef = useRef(null);

  const { sendMessage: storeSendMessage, editMessage: storeEditMessage, isSoundEnabled } = useChatStore();
  const doEditMessage = editMessageProp || storeEditMessage;
  // ✅ NEW: تنظیم «ارسال با Enter» از مودال تنظیمات
  const enterToSend = useSettingsStore((state) => state.enterToSend);

  useEffect(() => {
    if (editingMessageId) {
      setText(editingText);
    }
  }, [editingMessageId]);

  const buildPayload = (extra = {}) => ({
    text: text.trim(),
    image: imageFile || null,
    file: documentFile || null,
    fileName: documentFile?.name || null,
    messageType: "text",
    meta: null,
    ...extra,
  });

  const resetAttachments = () => {
    setText("");
    setImageFile(null);
    setDocumentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dispatchSend = (payload) => {
    if (sendMessageProp) {
      sendMessageProp(payload);
    } else {
      storeSendMessage(payload);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() && !imageFile && !documentFile) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    if (editingMessageId) {
      doEditMessage(editingMessageId, text, imageFile);
      setEditingMessageId(null);
      setEditingText("");
      setText("");
      return;
    }

    let payload;
    if (imageFile) {
      payload = buildPayload({ messageType: "image", image: imageFile });
    } else if (documentFile) {
      payload = buildPayload({ messageType: "file", file: documentFile, fileName: documentFile.name });
    } else {
      payload = buildPayload({});
    }

    dispatchSend(payload);
    resetAttachments();
  };

  // ✅ NEW: وقتی «ارسال با Enter» خاموشه، جلوی submit شدن فرم با Enter رو
  // می‌گیریم — کاربر مجبوره روی دکمه‌ی ارسال کلیک کنه
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !enterToSend) {
      e.preventDefault();
    }
  };

  // ---- ارسال مستقیم از منوی + (بدون نیاز به دکمه‌ی ارسال، مثل لوکیشن/مخاطب/نظرسنجی) ----
  const sendDirect = (payload) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    const finalPayload = { text: "", image: null, file: null, fileName: null, meta: null, ...payload };
    dispatchSend(finalPayload);
  };

  // ---- ارسال پیام صوتی/ویدیویی که از VoiceRecorder میاد (یه Blob خام) ----
  const handleVoiceSend = (blob, messageType) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();

    const fileName = `${messageType}-${Date.now()}.webm`;
    const asFile = new File([blob], fileName, { type: blob.type });

    dispatchSend({
      text: "",
      image: null,
      file: asFile,
      fileName,
      messageType, // "voice" یا "video_note"
      meta: null,
    });
  };

  const removeImage = () => {
    setImageFile(null);
  };

  const removeDocument = () => {
    setDocumentFile(null);
  };

  const hasContent = !!(text.trim() || imageFile || documentFile);

  return (
    <div className="p-3 border-t border-slate-700/50">
      {imageFile && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={URL.createObjectURL(imageFile)}
              alt="پیش‌نمایش تصویر"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={removeImage}
              type="button"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {documentFile && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
            <FileTextIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <span className="text-slate-300 text-sm truncate max-w-[200px]">{documentFile.name}</span>
            <button
              onClick={removeDocument}
              type="button"
              className="text-slate-400 hover:text-slate-200 flex-shrink-0"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {replyTarget && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 bg-slate-800/60 border-r-4 border-cyan-500 rounded-lg px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-cyan-400 text-xs font-medium mb-0.5">{replyTarget.senderName || "پیام"}</p>
            <p className="text-slate-400 text-xs truncate">{replyTarget.text || "پیوست"}</p>
          </div>
          <button
            onClick={onCancelReply}
            type="button"
            className="text-slate-400 hover:text-slate-200 flex-shrink-0"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="پیام خود را بنویسید"
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4"
        />

        <AttachMenu
          onSelectGallery={(file) => setImageFile(file)}
          onSelectCamera={(file) => setImageFile(file)}
          onSelectDocument={(file) => setDocumentFile(file)}
          onSelectLocation={(coords) =>
            sendDirect({ messageType: "location", meta: { lat: coords.lat, lng: coords.lng } })
          }
          onSelectContact={(contact) =>
            sendDirect({ messageType: "contact", meta: contact })
          }
          onSelectPoll={(pollData) =>
            sendDirect({
              messageType: "poll",
              meta: { question: pollData.question, multiple: pollData.multiple, options: pollData.options },
            })
          }
        />

        <VoiceRecorder onSend={handleVoiceSend} />

        <button
          type="submit"
          disabled={!hasContent}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}