import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } = useChatStore();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const wsRef = useRef(null);

  // ========================== WebSocket وضعیت آنلاین ==========================
  useEffect(() => {
    getAllContacts();

    const token = localStorage.getItem("accessToken");
    if (!token) return;

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

    return () => wsRef.current && wsRef.current.close();
  }, []);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  // ========================== رندر لیست مخاطبین ==========================
  return (
    <>
      {allContacts.map((contact, idx) => {
        const isOnline = onlineUsers.some(id => String(id) === String(contact._id || contact.id));

        // ⚡ تعیین URL نهایی پروفایل مثل ChatHeader
        const profilePic =
          contact.profile?.startsWith("http")
            ? contact.profile
            : contact.raw?.profile?.startsWith("http")
            ? contact.raw.profile
            : contact.raw?.profile
            ? `http://localhost:8000${contact.raw.profile}`
            : "/avatar.png";

        const displayName =
          contact.name?.trim() ||
          (contact.first_name || contact.last_name
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
            : contact.email?.split("@")[0]) ||
          "کاربر ناشناخته";

        return (
          <div
            key={contact._id || contact.id || idx}
            className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => setSelectedUser(contact)}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* آواتار + وضعیت آنلاین */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
                  <img
                    src={profilePic}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.src = "/avatar.png")}
                  />
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    isOnline ? "bg-green-400" : "bg-gray-500"
                  }`}
                ></span>
              </div>

              {/* نام + وضعیت آنلاین */}
              <div className="flex flex-col min-w-0">
                <h4
                  className="text-slate-200 font-medium text-sm truncate"
                  title={displayName}
                >
                  {displayName}
                </h4>
                <p
                  className={`text-xs font-medium truncate ${
                    isOnline ? "text-green-400" : "text-slate-500"
                  }`}
                >
                  {isOnline ? "آنلاین" : "آفلاین"}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ContactList;
