import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";

function ChatsList() {
  const { getAllContacts, allContacts, isUsersLoading, setSelectedUser } = useChatStore();
  const { authUser } = useAuthStore();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const wsStatusRef = useRef(null);

  // ========================== دریافت کاربران ==========================
  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  // ========================== دریافت آخرین پیام‌ها (بار اول) ==========================
  const fetchLastMessage = async (contactId) => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await axios.get(`http://localhost:8000/chat/messages/${contactId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lastMsg = res.data[0] || null;
      if (lastMsg) {
        setLastMessages((prev) => ({ ...prev, [contactId]: lastMsg }));
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

  // ========================== WebSocket واحد: وضعیت آنلاین + پیام‌های لحظه‌ای ==========================
  useEffect(() => {
    if (!authUser?.id) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let reconnectTimer = null;

    const connect = () => {
      wsStatusRef.current = new WebSocket(`ws://localhost:8000/ws/online-status/?token=${token}`);

      wsStatusRef.current.onopen = () => {
        console.log("✅ Online WS connected");
        wsStatusRef.current.send(JSON.stringify({ type: "get_online_users" }));
      };

      wsStatusRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // ---- آپدیت وضعیت آنلاین ----
        if (data.type === "update_online_users") {
          setOnlineUsers(data.onlineUsers);
          return;
        }

        // ---- پیام جدید (لحظه‌ای) از هرکدوم از مکالمات ----
        if (data.type === "new_message_notify") {
          const msg = data.message;
          const myId = String(authUser.id);
          const senderId = String(msg.senderId);
          const receiverId = String(msg.receiverId);

          // شناسه‌ی طرف مقابل مکالمه (نه خود کاربر لاگین‌شده)
          const contactId = senderId === myId ? receiverId : senderId;

          setLastMessages((prev) => ({
            ...prev,
            [contactId]: msg,
          }));
          return;
        }

        // ---- ویرایش پیام ----
        if (data.type === "edit_message") {
          setLastMessages((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((contactId) => {
              if (String(updated[contactId]?.id) === String(data.messageId)) {
                updated[contactId] = { ...updated[contactId], text: data.newText };
              }
            });
            return updated;
          });
          return;
        }

        // ---- حذف پیام ----
        if (data.type === "delete_message") {
          setLastMessages((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((contactId) => {
              if (String(updated[contactId]?.id) === String(data.messageId)) {
                updated[contactId] = { ...updated[contactId], text: "پیامی وجود ندارد" };
              }
            });
            return updated;
          });
          return;
        }
      };

      wsStatusRef.current.onerror = (err) => {
        console.error("❌ Online WS Error", err);
      };

      wsStatusRef.current.onclose = () => {
        console.log("🔌 Online WS disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsStatusRef.current) {
        wsStatusRef.current.onclose = null;
        wsStatusRef.current.close();
      }
    };
  }, [authUser?.id]);

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

        const profilePicUrl = contact.profile?.startsWith("http")
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
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    isOnline ? "bg-green-400" : "bg-gray-500"
                  }`}
                ></span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-slate-200 font-medium text-sm truncate" title={displayName}>
                  {displayName}
                </h4>
                <p
                  className={`text-xs font-medium truncate ${
                    lastMessageText ? "text-slate-300" : "text-slate-500"
                  }`}
                >
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