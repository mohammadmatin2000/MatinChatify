import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();

  const [isOnline, setIsOnline] = useState(false);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    if (!selectedUser) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const connect = () => {
      if (
        wsRef.current &&
        (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        )
      ) {
        return;
      }

      wsRef.current = new WebSocket(
        `ws://localhost:8000/ws/online-status/?token=${token}`
      );

      wsRef.current.onopen = () => {
        console.log("🟢 Online WS connected");
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        console.log("ONLINE EVENT:", data);

        switch (data.type) {
          case "contacts_list": {
            const user = data.contacts.find(
              (u) => String(u.id) === String(selectedUser.id || selectedUser._id)
            );

            if (user) {
              setIsOnline(user.online);
            }

            break;
          }

          case "presence_update": {
            if (
              String(data.userId) ===
              String(selectedUser.id || selectedUser._id)
            ) {
              setIsOnline(data.online);
            }

            break;
          }

          default:
            break;
        }
      };

      wsRef.current.onerror = (e) => {
        console.log("Online WS Error", e);
      };

      wsRef.current.onclose = () => {
        console.log("🔴 Online WS Closed");

        reconnectRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectRef.current);

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedUser]);

  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") {
        setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", esc);

    return () => window.removeEventListener("keydown", esc);
  }, []);

  if (!selectedUser) return null;

  const profilePic =
    selectedUser.profile?.startsWith("http")
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
          <h3 className="text-slate-100 font-medium">
            {selectedUser.name}
          </h3>

          <p className="text-sm text-slate-400">
            {isOnline ? "آنلاین" : "آفلاین"}
          </p>
        </div>

      </div>

      <button onClick={() => setSelectedUser(null)}>
        <XIcon className="w-5 h-5 text-slate-400 hover:text-white" />
      </button>

    </div>
  );
}

export default ChatHeader;