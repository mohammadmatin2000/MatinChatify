import { useState } from "react";
import { MoreVertical, Ban, Flag, ShieldCheck, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

// ✅ NEW: منوی مسدودسازی/گزارش کاربر — دقیقاً کنار دکمه‌ی بستن توی ChatHeader قرار می‌گیره
const REPORT_REASONS = [
  { value: "spam", label: "اسپم" },
  { value: "harassment", label: "مزاحمت" },
  { value: "fake_account", label: "اکانت جعلی" },
  { value: "inappropriate", label: "محتوای نامناسب" },
  { value: "other", label: "غیره" },
];

function ChatHeaderMenu({ userId, userName }) {
  const { blockStatus, blockUser, unblockUser, reportUser } = useChatStore();
  const isBlocked = blockStatus.iBlockedThem;

  const [showMenu, setShowMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDesc, setReportDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const handleToggleBlock = async () => {
    setLoading(true);
    const ok = isBlocked ? await unblockUser(userId) : await blockUser(userId);
    setLoading(false);
    if (ok) {
      setShowBlockConfirm(false);
      setShowMenu(false);
    }
  };

  const handleReport = async () => {
    setLoading(true);
    const ok = await reportUser(userId, reportReason, reportDesc);
    setLoading(false);
    if (ok) {
      setReportSent(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSent(false);
        setReportDesc("");
        setShowMenu(false);
      }, 1200);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className="group w-10 h-10 rounded-full flex items-center justify-center
                   text-slate-400 hover:text-slate-100 hover:bg-slate-700/50
                   active:scale-90 transition-all duration-200"
        title="گزینه‌های بیشتر"
      >
        <MoreVertical className="w-[18px] h-[18px]" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700/50 rounded-lg shadow-2xl w-56 z-50 overflow-hidden">
            <button
              onClick={() => setShowBlockConfirm(true)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-right hover:bg-slate-700/50 transition-colors"
            >
              {isBlocked ? (
                <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span className={isBlocked ? "text-green-400" : "text-red-400"}>
                {isBlocked ? "رفع مسدودیت" : "مسدود کردن"}
              </span>
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-right hover:bg-slate-700/50 transition-colors border-t border-slate-700/40"
            >
              <Flag className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-amber-400">گزارش کاربر</span>
            </button>
          </div>
        </>
      )}

      {showBlockConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-slate-100 font-semibold text-base mb-2">
              {isBlocked ? "رفع مسدودیت" : "مسدود کردن"} {userName}؟
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              {isBlocked
                ? "بعد از رفع مسدودیت، این کاربر می‌تونه دوباره برات پیام بفرسته و تماس بگیره."
                : "دیگه پیام یا تماسی از این کاربر دریافت نمی‌کنی و اونم پیامای تو رو نمی‌بینه."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm"
              >
                انصراف
              </button>
              <button
                onClick={handleToggleBlock}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm"
              >
                {loading ? "..." : isBlocked ? "رفع مسدودیت" : "مسدود کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-100 font-semibold text-base">گزارش {userName}</h3>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSent ? (
              <p className="text-green-400 text-sm text-center py-4">گزارش ثبت شد ✅</p>
            ) : (
              <>
                <div className="space-y-1.5 mb-3">
                  {REPORT_REASONS.map((r) => (
                    <div
                      key={r.value}
                      onClick={() => setReportReason(r.value)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-700/40"
                    >
                      <span className="text-slate-200 text-sm">{r.label}</span>
                      <div
                        className={`w-4 h-4 rounded-full border ${
                          reportReason === r.value ? "border-cyan-500 bg-cyan-500" : "border-slate-500"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="توضیح بیشتر (اختیاری)"
                  rows={2}
                  className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 resize-none mb-3"
                />
                <button
                  onClick={handleReport}
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {loading ? "در حال ارسال..." : "ارسال گزارش"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatHeaderMenu;