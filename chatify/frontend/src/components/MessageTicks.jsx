import { Check, CheckCheck, Clock } from "lucide-react";

// تیک وضعیت پیام مثل واتساب
// status: "sending" (در حال ارسال) | "sent" (ارسال شده، خونده نشده) | "read" (خونده شده)
function MessageTicks({ isOwn, status }) {
  if (!isOwn) return null;

  if (status === "sending") {
    return <Clock className="w-3 h-3 text-white/60 flex-shrink-0" />;
  }
  if (status === "read") {
    // ✅ FIX: قبلاً text-sky-300 (آبی روشن) بود که روی حباب فیروزه‌ای
    // تقریباً محو می‌شد و اصلاً معلوم نبود پیام خونده شده یا نه.
    // amber-400 یه رنگ کاملاً متضاد با طیف آبی/فیروزه‌ایه، پس با
    // بالاترین کنتراست ممکن روی حباب دیده می‌شه.
    return <CheckCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  }
  return <CheckCheck className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />;
}

export default MessageTicks;