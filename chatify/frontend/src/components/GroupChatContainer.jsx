import { useEffect, useState, useRef } from "react";
import axios from "axios";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import { XIcon } from "lucide-react";

function GroupChatContainer({ group, onBack }) {
  if (!group || !(group._id || group.id)) return null;

  const groupId = group._id || group.id;
  const accessToken = localStorage.getItem("accessToken");
  const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");

  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);

  // -------------------------
  // اتصال WebSocket
  // -------------------------
  useEffect(() => {
    if (!groupId || !accessToken) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.hostname}:8000/ws/groups/${groupId}/?token=${accessToken}`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => console.log("✅ WS connected:", groupId);

    socketRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "message") {
        setMessages((prev) => [...prev, data]);
      }

      if (data.type === "user_event" && data.user) {
        setMembers((prev) =>
          data.event === "joined"
            ? [...prev, data.user.email || "Unknown"]
            : prev.filter((u) => u !== (data.user.email || "Unknown"))
        );
      }
    };

    socketRef.current.onerror = (err) => console.error("❌ WS Error:", err);
    socketRef.current.onclose = () => console.log("ℹ️ WS closed");

    return () => socketRef.current?.close();
  }, [groupId, accessToken]);

  // -------------------------
  // دریافت پیام‌ها از API
  // -------------------------
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      setIsMessagesLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:8000/groups/groups/${groupId}/messages/`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (isMounted) setMessages(res.data);
      } catch (err) {
        console.error("❌ Error fetching messages:", err);
      } finally {
        if (isMounted) setIsMessagesLoading(false);
      }
    };

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [groupId, accessToken]);

  // -------------------------
  // Scroll خودکار
  // -------------------------
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------
  // ارسال پیام
  // -------------------------
  const sendMessage = () => {
    if (!text.trim() || !socketRef.current) return;

    socketRef.current.send(JSON.stringify({ action: "message", text }));
    setText("");
  };

  // -------------------------
  // Header گروه
  // -------------------------
  const GroupChatHeader = () => {
    const groupAvatarUrl = group.avatar
      ? group.avatar.startsWith("http")
        ? group.avatar
        : `http://localhost:8000${group.avatar}`
      : `http://localhost:8000/static/group-avatar.png`;

    return (
      <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
            <img
              src={groupAvatarUrl}
              alt={group.name || "گروه"}
              className="object-cover w-full h-full"
              onError={(e) => (e.target.src = "/static/group-avatar.png")}
            />
          </div>
          <div>
            <h1 className="text-slate-200 font-medium text-base">{group.name}</h1>
          </div>
        </div>
        <button onClick={onBack} className="p-2">
          <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"/>
        </button>
      </div>
    );
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="flex flex-col h-full">
      <GroupChatHeader />

      {/* اعضای گروه */}
      <div className="bg-slate-800 p-4 text-slate-200">
        <h3 className="text-lg font-semibold">اعضای گروه</h3>
        <ul>
          {members.map((member) => (
            <li key={member} className="text-sm">{member}</li>
          ))}
        </ul>
      </div>

      {/* پیام‌ها */}
      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder name={group.name} onQuickReply={(msg) => setText(msg)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              const isOwner = msg.sender?.id === authUser?.id;
              return (
                <div key={msg.id} className={`chat ${isOwner ? "chat-end" : "chat-start"}`}>
                  <div
                    className={`chat-bubble relative ${isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"}`}
                    onClick={() => isOwner && setActiveMenu(activeMenu === msg.id ? null : msg.id)}
                  >
                    {!isOwner && <p className="text-xs text-cyan-300 mb-1">{msg.sender?.email}</p>}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>

                    {isOwner && activeMenu === msg.id && (
                      <div className="absolute top-0 right-0 bg-slate-700 rounded shadow z-10 flex flex-col">
                        <button
                          className="px-3 py-1 text-xs text-cyan-200 hover:bg-slate-600"
                          onClick={() => {
                            setText(msg.text);
                            setActiveMenu(null);
                          }}
                        >
                          ویرایش
                        </button>
                        <button
                          className="px-3 py-1 text-xs text-red-400 hover:bg-slate-600"
                          onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      <MessageInput text={text} setText={setText} sendMessage={sendMessage} />
    </div>
  );
}

export default GroupChatContainer;
