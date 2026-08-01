import { XIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

// فوروارد پیام به یکی از مخاطبین چت خصوصی.
// ⚠️ فعلاً فقط فوروارد به چت خصوصی رو پوشش می‌ده — فوروارد به گروه دیگه
// نیاز به لیست گروه‌ها و انتخاب بینشون داره که می‌تونیم بعداً اضافه کنیم.
function ForwardMessageModal({ isOpen, onClose, message }) {
  const { allContacts, getAllContacts, setSelectedUser } = useChatStore();
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    if (isOpen) getAllContacts();
  }, [isOpen, getAllContacts]);

  if (!isOpen || !message) return null;

  const waitForSocket = () =>
    new Promise((resolve) => {
      let tries = 0;
      const check = () => {
        const socket = useChatStore.getState().socket;
        tries += 1;
        if (socket?.readyState === WebSocket.OPEN || tries > 20) resolve(socket);
        else setTimeout(check, 100);
      };
      check();
    });

  const handleForward = async (contact) => {
    const contactId = contact._id || contact.id;
    setSendingId(contactId);
    try {
      setSelectedUser(contact);
      const socket = await waitForSocket();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        toast.error("اتصال چت برقرار نشد — خودت این چت رو باز کن و دوباره امتحان کن");
        return;
      }

      await useChatStore.getState().sendMessage({
        text: message.text || "",
        image: message.image || null,
        file: message.file || null,
        fileName: message.fileName || null,
        messageType: message.messageType || (message.image ? "image" : message.file ? "file" : "text"),
        meta: message.meta || null,
      });

      toast.success(`پیام برای ${contact.name} فوروارد شد`);
      onClose();
    } catch (err) {
      console.error("خطا در فوروارد پیام:", err);
      toast.error("فوروارد ممکن نشد");
    } finally {
      setSendingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-semibold text-base">فوروارد به...</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {allContacts.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">مخاطبی نداری</p>
          ) : (
            allContacts.map((c) => {
              const cid = c._id || c.id;
              const profilePic = c.profile?.startsWith("http")
                ? c.profile
                : c.raw?.profile?.startsWith("http")
                ? c.raw.profile
                : c.raw?.profile
                ? `${API_BASE_URL}${c.raw.profile}`
                : "/avatar.png";
              return (
                <button
                  key={cid}
                  disabled={sendingId === cid}
                  onClick={() => handleForward(c)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 text-right transition-colors disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                    <img
                      src={profilePic}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                  </div>
                  <span className="text-slate-200 text-sm truncate flex-1">{c.name}</span>
                  {sendingId === cid && <span className="text-xs text-cyan-400 flex-shrink-0">در حال ارسال...</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ForwardMessageModal;