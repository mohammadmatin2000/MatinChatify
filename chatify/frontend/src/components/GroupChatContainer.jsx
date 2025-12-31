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

  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [text, setText] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const messageEndRef = useRef(null);

  // دریافت پیام‌ها
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
      setIsMessagesLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:8000/groups/${groupId}/messages/`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (isMounted) setMessages(res.data);
      } catch (err) {
        console.error("خطا در دریافت پیام‌ها:", err);
      } finally {
        if (isMounted) setIsMessagesLoading(false);
      }
    };
    fetchMessages();
    return () => { isMounted = false; };
  }, [groupId, accessToken]);

  // اسکرول خودکار
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ارسال پیام
  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:8000/groups/${groupId}/messages/`,
        { text },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setMessages(prev => [...prev, res.data]);
      setText("");
    } catch (err) {
      console.error("خطا در ارسال پیام:", err);
    }
  };

  // ویرایش پیام
  const editMessageHandler = (messageId, newText) => {
    setMessages(prev =>
      prev.map(m => (m._id === messageId ? { ...m, text: newText } : m))
    );
    setEditingMessageId(null);
    setEditingText("");
  };

  // =====================
  // هدر گروه مثل ChatHeader
  // =====================
  const GroupChatHeader = ({ group, onBack }) => {
    const groupAvatarUrl = group.avatar
      ? group.avatar.startsWith("http")
        ? group.avatar
        : `http://localhost:8000${group.avatar}`
      : `http://localhost:8000/group-avatar.png`;

    return (
      <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
        <div className="flex items-center gap-3">
          {/* آواتار گروه */}
          <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
            <img
              src={groupAvatarUrl}
              alt={group.name || "گروه"}
              className="object-cover w-full h-full"
              onError={(e) => (e.target.src = "/group-avatar.png")}
            />
          </div>

          {/* نام گروه */}
          <div>
            <h1 className="text-slate-200 font-medium text-base">{group.name}</h1>

          </div>
        </div>

        {/* دکمه بستن */}
        <button onClick={onBack} className="p-2">
          <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <GroupChatHeader group={group} onBack={onBack} />

      {/* لیست پیام‌ها */}
      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder
            name={group.name}
            onQuickReply={(msg) => setText(msg)}
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(msg => {
              const authUserId = JSON.parse(localStorage.getItem("authUser"))?.id;
              const isOwner = msg.sender?.id === authUserId;

              return (
                <div
                  key={msg._id || msg.id}
                  className={`chat ${isOwner ? "chat-end" : "chat-start"}`}
                >
                  <div
                    className={`chat-bubble relative ${isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"}`}
                    onClick={() => isOwner && setActiveMenu(activeMenu === msg._id ? null : msg._id)}
                  >
                    {!isOwner && (
                      <p className="text-xs text-cyan-300 mb-1">{msg.sender?.first_name}</p>
                    )}

                    {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                    {msg.image && (
                      <img
                        src={msg.image.startsWith("http") ? msg.image : `http://localhost:8000${msg.image}`}
                        alt="img"
                        className="rounded-lg max-h-64 mt-1 cursor-pointer"
                        onClick={() => window.open(msg.image.startsWith("http") ? msg.image : `http://localhost:8000${msg.image}`, "_blank")}
                      />
                    )}

                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>

                    {isOwner && activeMenu === msg._id && (
                      <div className="absolute top-0 right-0 bg-slate-700 rounded shadow z-10 flex flex-col">
                        <button
                          className="px-3 py-1 text-xs text-cyan-200 hover:bg-slate-600"
                          onClick={() => {
                            setEditingMessageId(msg._id);
                            setEditingText(msg.text);
                            setActiveMenu(null);
                            setText(msg.text);
                          }}
                        >
                          ویرایش
                        </button>
                        <button
                          className="px-3 py-1 text-xs text-red-400 hover:bg-slate-600"
                          onClick={() => setMessages(prev => prev.filter(m => m._id !== msg._id))}
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

      <MessageInput
        text={text}
        setText={setText}
        editingMessageId={editingMessageId}
        editingText={editingText}
        setEditingMessageId={setEditingMessageId}
        setEditingText={setEditingText}
        onSend={() => {
          if (editingMessageId) {
            editMessageHandler(editingMessageId, editingText);
          } else {
            sendMessage();
          }
        }}
      />
    </div>
  );
}

export default GroupChatContainer;
