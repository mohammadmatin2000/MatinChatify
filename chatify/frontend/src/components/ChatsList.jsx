import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";

function ChatsList() {
  const { getAllContacts, allContacts, isUsersLoading, setSelectedUser, currentUser } = useChatStore();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const wsStatusRef = useRef(null);
  const wsChatRef = useRef(null);

  // ========================== دریافت کاربران و وضعیت آنلاین ==========================
  useEffect(() => {
    getAllContacts();

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    wsStatusRef.current = new WebSocket(`ws://localhost:8000/ws/online-status/?token=${token}`);

    wsStatusRef.current.onopen = () => {
      console.log("✅ Online WS connected");
      wsStatusRef.current.send(JSON.stringify({ type: "get_online_users" }));
    };

    wsStatusRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "update_online_users") {
        console.log("📡 Online users:", data.onlineUsers);
        setOnlineUsers(data.onlineUsers);
      }
    };

    wsStatusRef.current.onclose = () => console.log("🔌 Online WS disconnected");

    return () => wsStatusRef.current && wsStatusRef.current.close();
  }, [getAllContacts]);

  // ========================== دریافت آخرین پیام‌ها ==========================
  const fetchLastMessage = async (contactId) => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await axios.get(`http://localhost:8000/chat/messages/${contactId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lastMsg = res.data[0] || null;
      if (lastMsg) {
        setLastMessages((prev) => ({ ...prev, [contactId]: lastMsg }));
        console.log(`📥 Last message fetched for ${contactId}:`, lastMsg);
      }
    } catch (err) {
      console.error("Error fetching last message for", contactId, err);
    }
  };

  useEffect(() => {
    if (!allContacts || allContacts.length === 0) return;
    allContacts.forEach((contact) => {
      const contactId = contact?.id || contact?._id;
      if (!contactId) return;
      fetchLastMessage(contactId);
    });
  }, [allContacts]);

  // ========================== WebSocket برای پیام‌های لحظه‌ای ==========================
  useEffect(() => {
    if (!currentUser) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    wsChatRef.current = new WebSocket(`ws://localhost:8000/ws/chat/${currentUser.id}_all/?token=${token}`);

    wsChatRef.current.onopen = () => console.log("✅ Chat WS connected");

    wsChatRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 WS message received:", data);

      setLastMessages((prev) => {
        const updated = { ...prev };

        if (data.type === "chat_message") {
          const msg = data.message;
          const contactId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
          updated[contactId] = msg;
        }

        if (data.type === "edit_message") {
          Object.keys(updated).forEach((contactId) => {
            if (updated[contactId]?.id === data.messageId) {
              updated[contactId] = { ...updated[contactId], text: data.newText };
            }
          });
        }

        if (data.type === "delete_message") {
          Object.keys(updated).forEach((contactId) => {
            if (updated[contactId]?.id === data.messageId) {
              updated[contactId] = { ...updated[contactId], text: "پیامی وجود ندارد" };
            }
          });
        }

        console.log("🟢 Last messages updated:", updated);
        return updated;
      });
    };

    wsChatRef.current.onclose = () => console.log("🔌 Chat WS disconnected");

    return () => wsChatRef.current && wsChatRef.current.close();
  }, [currentUser]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (!allContacts || allContacts.length === 0) return <NoChatsFound />;

  return (
    <div className="space-y-2">
      {allContacts.map((contact) => {
        const contactId = contact?.id || contact?._id;
        if (!contactId) return null;

        const lastMessageObj = lastMessages[contactId];
        const lastMessageText = lastMessageObj?.text || "پیامی وجود ندارد";
        const lastMessageDate = lastMessageObj?.createdAt ? new Date(lastMessageObj.createdAt) : null;
        const isOnline = onlineUsers.some((id) => String(id) === String(contactId));

        const displayName =
          contact.name?.trim() ||
          (contact.first_name || contact.last_name
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
            : contact.email?.split("@")[0]) ||
          "کاربر ناشناس";

        const profilePicUrl =
          contact.profile?.startsWith("http")
            ? contact.profile
            : contact.raw?.profile?.startsWith("http")
            ? contact.raw.profile
            : contact.raw?.profile
            ? `http://localhost:8000${contact.raw.profile}`
            : "/avatar.png";

        return (
          <div
            key={contactId}
            className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => setSelectedUser(contact)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
                  <img
                    src={profilePicUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.src = "/avatar.png")}
                  />
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${isOnline ? "bg-green-400" : "bg-gray-500"}`}
                ></span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-slate-200 font-medium text-sm truncate" title={displayName}>
                  {displayName}
                </h4>
                <p className={`text-xs font-medium truncate ${lastMessageText ? "text-slate-300" : "text-slate-500"}`}>
                  {lastMessageText}
                </p>
              </div>
              <div className="ml-auto text-slate-400 text-xs">
                {lastMessageDate ? formatDistanceToNow(lastMessageDate, { addSuffix: true }) : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChatsList;
