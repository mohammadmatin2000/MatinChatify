import { Check, CheckCheck, Clock } from "lucide-react";

// ✅ NEW: تیک وضعیت پیام مثل واتساب
// status: "sending" (در حال ارسال) | "sent" (ارسال شده، خونده نشده) | "read" (خونده شده)
function MessageTicks({ isOwn, status }) {
  if (!isOwn) return null;

  if (status === "sending") {
    return <Clock className="w-3 h-3 text-white/60 flex-shrink-0" />;
  }
  if (status === "read") {
    return <CheckCheck className="w-3.5 h-3.5 text-sky-300 flex-shrink-0" />;
  }
  return <CheckCheck className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />;
}

export default MessageTicks;