import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useState, useRef } from "react";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);

  // ⚡ تابع برای اتصال WebSocket
  const connectWebSocket = () => {
    const token = localStorage.getItem("accessToken");
    if (!token || !selectedUser) return;

    wsRef.current = new WebSocket(`ws://localhost:8000/ws/online-status/?token=${token}`);

    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({ type: "get_online_users" }));
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "update_online_users") {
        setOnlineUsers(data.onlineUsers);
      }
    };

    wsRef.current.onerror = () => {};

    wsRef.current.onclose = () => {
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
    };
  };

  // ⚡ مدیریت اتصال WebSocket
  useEffect(() => {
    if (!selectedUser) return;
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [selectedUser]);

  // ⚡ محاسبه وضعیت آنلاین کاربر
  useEffect(() => {
    if (!selectedUser?._id) return;
    const normalizedOnlineUsers = onlineUsers.map((id) => id.toString());
    const userId = selectedUser._id.toString();
    setIsOnline(normalizedOnlineUsers.includes(userId));
  }, [selectedUser, onlineUsers]);

  // ⚡ کلید Escape برای بستن چت
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  if (!selectedUser) return null;

  // ⚡ تعیین URL نهایی عکس پروفایل
  const profilePicUrl =
    selectedUser.profile?.startsWith("http")
      ? selectedUser.profile
      : selectedUser.raw?.profile?.startsWith("http")
      ? selectedUser.raw.profile
      : selectedUser.raw?.profile
      ? `http://localhost:8000${selectedUser.raw.profile}`
      : `http://localhost:8000/avatar.png`;

  return (
    <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
      <div className="flex items-center gap-3">
        {/* آواتار */}
        <div className={`avatar ${isOnline ? "online" : "offline"}`}>
          <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
            <img
              src={profilePicUrl}
              alt={selectedUser.fullName || selectedUser.name || "کاربر ناشناس"}
              onError={(e) => (e.target.src = "/avatar.png")}
              className="object-cover w-full h-full"
            />
          </div>
        </div>

        {/* نام و وضعیت */}
        <div>
          <h3 className="text-slate-200 font-medium text-base">
            {selectedUser.fullName || selectedUser.name || "کاربر ناشناس"}
          </h3>
          <p className="text-slate-400 text-sm">
            {isOnline ? "آنلاین 🟢" : "آفلاین ⚫"}
          </p>
        </div>
      </div>

      {/* دکمه بستن */}
      <button onClick={() => setSelectedUser(null)} className="p-2">
        <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
      </button>
    </div>
  );
}

export default ChatHeader;
