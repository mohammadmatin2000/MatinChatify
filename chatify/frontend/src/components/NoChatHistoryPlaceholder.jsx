import { MessageCircleIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name, onQuickReply }) => {
  const quickReplies = [
    "👋 سلام!",
    "🤝 حالت چطوره؟",
    "📅 زود همدیگه رو ببینیم؟"
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-cyan-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-200 mb-3">
        گفت‌وگوی خود با {name} را شروع کنید
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          این ابتدای گفت‌وگوی شماست. برای شروع پیام ارسال کنید!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mx-auto"></div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {quickReplies.map((msg) => (
          <button
            key={msg}
            onClick={() => onQuickReply?.(msg)}
            className="px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full hover:bg-cyan-500/20 transition-colors"
          >
            {msg}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;
