import { XIcon } from "lucide-react";
import { createPortal } from "react-dom";

// اطلاعات پیام — چون بک‌اند رسید خوانده‌شدن نداره، فقط زمان ارسال و
// وضعیت ویرایش رو نشون می‌ده
function MessageInfoModal({ isOpen, onClose, data }) {
  if (!isOpen || !data?.msg) return null;

  const { msg, senderName } = data;
  const sentDate = msg.createdAt || msg.created_at || msg.created_date;
  const formatted = sentDate
    ? new Date(sentDate).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })
    : "نامشخص";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-semibold text-base">اطلاعات پیام</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {senderName && (
            <div className="flex justify-between">
              <span className="text-slate-400">فرستنده</span>
              <span className="text-slate-200">{senderName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">زمان ارسال</span>
            <span className="text-slate-200">{formatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">وضعیت</span>
            <span className="text-slate-200">{msg.edited ? "ویرایش‌شده" : "ارسال‌شده"}</span>
          </div>
          <p className="text-slate-500 text-xs pt-2 border-t border-slate-700/50">
            رسید خوانده‌شدن هنوز پشتیبانی نمی‌شه؛ این بخش فقط زمان و وضعیت ویرایش رو نشون می‌ده.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MessageInfoModal;