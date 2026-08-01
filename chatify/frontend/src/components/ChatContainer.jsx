import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import MessageInput from "./MessageInput";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import { FileTextIcon, MapPinIcon, DownloadIcon, CheckIcon } from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

const resolveUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE_URL}${url}`);

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    editMessage,
    deleteMessage,
    votePoll,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [activeMenu, setActiveMenu] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!selectedUser) return;
    getMessagesByUserId();
    subscribeToMessages(selectedUser._id);
    return () => unsubscribeFromMessages();
  }, [selectedUser]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (!selectedUser) return null;

  // ✅ رندر نظرسنجی (سؤال + گزینه‌ها با نوار درصد رأی)
  const renderPoll = (msg) => {
    const { question, options = [], multiple } = msg.meta || {};
    const totalVotes = options.reduce((sum, o) => sum + (o.voters?.length || 0), 0);

    return (
      <div className="min-w-[220px]">
        <p className="font-medium mb-2">{question}</p>
        <div className="space-y-1.5">
          {options.map((opt) => {
            const voteCount = opt.voters?.length || 0;
            const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const hasVoted = opt.voters?.includes(authUser?.id);

            return (
              <button
                key={opt.id}
                onClick={() => votePoll(msg._id, opt.id)}
                className="w-full text-right relative overflow-hidden rounded-lg bg-black/20 hover:bg-black/30 transition-colors p-2"
              >
                <div
                  className="absolute inset-y-0 right-0 bg-cyan-400/20"
                  style={{ width: `${percent}%` }}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-sm flex items-center gap-1.5">
                    {hasVoted && <CheckIcon className="w-3.5 h-3.5 text-cyan-300" />}
                    {opt.text}
                  </span>
                  <span className="text-xs opacity-70 flex-shrink-0">{percent}%</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs opacity-60 mt-1.5">
          {totalVotes} رأی {multiple ? "· چند انتخابی" : ""}
        </p>
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    const type = msg.messageType || "text";

    if (type === "poll" && msg.meta?.options) {
      return renderPoll(msg);
    }

    if (type === "location" && msg.meta?.lat) {
      const mapUrl = `https://www.google.com/maps?q=${msg.meta.lat},${msg.meta.lng}`;
      return (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg p-2 transition-colors"
        >
          <MapPinIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">مشاهده لوکیشن روی نقشه</span>
        </a>
      );
    }

    if (type === "contact" && msg.meta?.name) {
      return (
        <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
            <img
              src={msg.meta.image || "/avatar.png"}
              alt={msg.meta.name}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.src = "/avatar.png")}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{msg.meta.name}</p>
            {msg.meta.email && <p className="text-xs opacity-70 truncate">{msg.meta.email}</p>}
          </div>
        </div>
      );
    }

    if (type === "file" && msg.file) {
      return (
        <a
          href={resolveUrl(msg.file)}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg p-2 transition-colors"
        >
          <FileTextIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm truncate max-w-[180px]">{msg.fileName || "فایل"}</span>
          <DownloadIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
        </a>
      );
    }

    return null;
  };

  return (
    <>
      <ChatHeader />

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder
            name={selectedUser.name}
            onQuickReply={(msg) => {
              setText(msg);
              setEditingMessageId(null);
              setEditingText("");
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              if (msg.senderId === null) {
                return (
                  <div key={msg._id} className="text-center text-gray-400 italic my-2">
                    {msg.text}
                  </div>
                );
              }

              const isOwner = String(msg.senderId) === String(authUser?.id);
              const specialContent = renderMessageContent(msg);

              return (
                <div key={msg._id} className={`chat ${isOwner ? "chat-end" : "chat-start"}`}>
                  <div
                    className={`chat-bubble relative ${
                      isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"
                    }`}
                    onClick={() =>
                      isOwner &&
                      msg.messageType !== "poll" &&
                      setActiveMenu(activeMenu === msg._id ? null : msg._id)
                    }
                  >
                    {msg.image && (
                      <div className="mt-1">
                        <img
                          src={
                            msg.image.startsWith("data:image")
                              ? msg.image
                              : msg.image.startsWith("http")
                              ? msg.image
                              : `${API_BASE_URL}${msg.image}`
                          }
                          alt="Shared"
                          className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={() =>
                            window.open(
                              msg.image.startsWith("http") ? msg.image : `${API_BASE_URL}${msg.image}`,
                              "_blank"
                            )
                          }
                        />
                      </div>
                    )}

                    {specialContent && <div className="mt-1">{specialContent}</div>}

                    {msg.text && (
                      <p className="mt-2 whitespace-pre-wrap break-words">{msg.text}</p>
                    )}

                    <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                      {msg.createdAt instanceof Date
                        ? msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "🕒"}
                    </p>

                    {isOwner && activeMenu === msg._id && (
                      <div className="absolute top-0 right-0 bg-slate-700 rounded-md shadow-lg z-10 flex flex-col">
                        {msg.text && (
                          <button
                            className="px-3 py-1 text-xs text-cyan-200 hover:bg-slate-600 hover:text-cyan-400 rounded-t-md"
                            onClick={() => {
                              setEditingMessageId(msg._id);
                              setEditingText(msg.text);
                              setActiveMenu(null);
                              setText(msg.text);
                            }}
                          >
                            ویرایش
                          </button>
                        )}
                        <button
                          className="px-3 py-1 text-xs text-red-400 hover:bg-slate-600 hover:text-red-600 rounded-b-md"
                          onClick={() => deleteMessage(msg._id)}
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
      />
    </>
  );
}

export default ChatContainer;