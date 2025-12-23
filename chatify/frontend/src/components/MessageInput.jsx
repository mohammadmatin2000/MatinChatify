import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";

export default function MessageInput({
  text,
  setText,
  editingMessageId,
  editingText,
  setEditingMessageId,
  setEditingText,
}) {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage, editMessage, isSoundEnabled } = useChatStore();

  useEffect(() => {
    if (editingMessageId) {
      setText(editingText);
    }
  }, [editingMessageId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() && !imageFile) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    if (editingMessageId) {
      editMessage(editingMessageId, text, imageFile);
      setEditingMessageId(null);
      setEditingText("");
    } else {
      sendMessage({ text: text.trim(), image: imageFile });
    }

    setText("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

      <form onSubmit={handleSend} className="max-w-3xl mx-auto flex space-x-4">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="پیام خود را بنویسید"
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4"
        />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors ${
            imageFile ? "text-cyan-500" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={!text.trim() && !imageFile}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
