import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";

function ChatHeader() {
  const { selectedUser, setSelectedUser, onlineUsers } = useChatStore();

  // ✅ دیگه اینجا هیچ WebSocket ای ساخته نمی‌شه.
  // وضعیت آنلاین از اتصال مرکزی (که در useChatStore و useAuthStore مدیریت می‌شه) خونده می‌شه.
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

      <button onClick={() => setSelectedUser(null)}>
        <XIcon className="w-5 h-5 text-slate-400 hover:text-white" />
      </button>
    </div>
  );
}

export default ChatHeader;