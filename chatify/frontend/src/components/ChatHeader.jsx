import { XIcon, PhoneIcon, VideoIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { useEffect } from "react";

function ChatHeader() {
  const { selectedUser, setSelectedUser, onlineUsers } = useChatStore();
  // ✅ NEW: برای شروع تماس صوتی/تصویری با همین مخاطب باز شده
  const { startCall, callStatus } = useCallStore();

  const isOnline = selectedUser
    ? onlineUsers.some((id) => String(id) === String(selectedUser.id || selectedUser._id))
    : false;

  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") {
        setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", esc);

    return () => window.removeEventListener("keydown", esc);
  }, [setSelectedUser]);

  if (!selectedUser) return null;

  const profilePic = selectedUser.profile?.startsWith("http")
    ? selectedUser.profile
    : selectedUser.raw?.profile?.startsWith("http")
    ? selectedUser.raw.profile
    : selectedUser.raw?.profile
    ? `http://localhost:8000${selectedUser.raw.profile}`
    : "/avatar.png";

  // ✅ NEW: تماس فقط وقتی می‌شه شروع کرد که در حال حاضر توی تماس دیگه‌ای نباشیم
  const canCall = callStatus === "idle";

  const handleAudioCall = () => {
    if (!canCall) return;
    startCall(
      { id: selectedUser.id || selectedUser._id, name: selectedUser.name, image: profilePic },
      "audio"
    );
  };

  const handleVideoCall = () => {
    if (!canCall) return;
    startCall(
      { id: selectedUser.id || selectedUser._id, name: selectedUser.name, image: profilePic },
      "video"
    );
  };

  return (
    <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 px-6 h-[84px]">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
            <img
              src={profilePic}
              alt={selectedUser.name}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>

          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
              isOnline ? "bg-green-500" : "bg-gray-500"
            }`}
          />
        </div>

        <div>
          <h3 className="text-slate-100 font-medium">{selectedUser.name}</h3>
          <p className="text-sm text-slate-400">{isOnline ? "آنلاین" : "آفلاین"}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* ✅ تماس صوتی — دایره‌ی cyan با هاله‌ی نرم موقع hover */}
        <button
          onClick={handleAudioCall}
          disabled={!canCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-cyan-500/10 text-cyan-400
                     hover:bg-cyan-500/20 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-cyan-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title="تماس صوتی"
        >
          <PhoneIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        {/* ✅ تماس تصویری — دایره‌ی بنفش برای تمایز بصری از تماس صوتی */}
        <button
          onClick={handleVideoCall}
          disabled={!canCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-violet-500/10 text-violet-400
                     hover:bg-violet-500/20 hover:shadow-[0_0_16px_rgba(167,139,250,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-violet-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title="تماس تصویری"
        >
          <VideoIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        {/* جداکننده‌ی ظریف بین دکمه‌های تماس و بستن */}
        <span className="w-px h-6 bg-slate-700/60 mx-1" />

        <button
          onClick={() => setSelectedUser(null)}
          className="group w-10 h-10 rounded-full flex items-center justify-center
                     text-slate-400 hover:text-slate-100 hover:bg-slate-700/50
                     active:scale-90 transition-all duration-200"
          title="بستن گفتگو"
        >
          <XIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:rotate-90" />
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;