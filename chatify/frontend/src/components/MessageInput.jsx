import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { SendIcon, XIcon, FileTextIcon } from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import AttachMenu from "./AttachMenu";

export default function MessageInput({
  text,
  setText,
  editingMessageId,
  editingText,
  setEditingMessageId,
  setEditingText,
  sendMessage: sendMessageProp,
}) {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [imageFile, setImageFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const fileInputRef = useRef(null);

  const { sendMessage: storeSendMessage, editMessage, isSoundEnabled } = useChatStore();
  const doSendMessage = sendMessageProp || storeSendMessage;

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

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() && !imageFile && !documentFile) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    if (editingMessageId) {
      editMessage(editingMessageId, text, imageFile);
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

    if (sendMessageProp) {
      sendMessageProp(payload);
    } else {
      storeSendMessage(payload);
    }

    resetAttachments();
  };

  // ---- ارسال مستقیم از منوی + (بدون نیاز به دکمه‌ی ارسال) ----
  const sendDirect = (payload) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    const finalPayload = { text: "", image: null, file: null, fileName: null, meta: null, ...payload };
    if (sendMessageProp) {
      sendMessageProp(finalPayload);
    } else {
      storeSendMessage(finalPayload);
    }
  };

  const removeImage = () => setImageFile(null);
  const removeDocument = () => setDocumentFile(null);

  return (
    <div className="p-4 border-t border-slate-700/50">
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

      <form onSubmit={handleSend} className="max-w-3xl mx-auto flex space-x-4">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
          onSelectContact={(contact) => sendDirect({ messageType: "contact", meta: contact })}
          onSelectPoll={(pollData) =>
            sendDirect({
              messageType: "poll",
              meta: { question: pollData.question, multiple: pollData.multiple, options: pollData.options },
            })
          }
        />

        <button
          type="submit"
          disabled={!text.trim() && !imageFile && !documentFile}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}