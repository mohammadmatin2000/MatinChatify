import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import MessageInput from "./MessageInput";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";

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
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [activeMenu, setActiveMenu] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [text, setText] = useState("");

  // 📥 دریافت پیام‌ها هنگام انتخاب کاربر
  useEffect(() => {
    if (!selectedUser) return;
    getMessagesByUserId();
    subscribeToMessages(selectedUser._id);
    return () => unsubscribeFromMessages();
  }, [selectedUser]);

  // ⬇️ اسکرول خودکار به پایین چت هنگام دریافت پیام
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (!selectedUser) return null;

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
              // پیام سیستم
              if (msg.senderId === null) {
                return (
                  <div
                    key={msg._id}
                    className="text-center text-gray-400 italic my-2"
                  >
                    {msg.text}
                  </div>
                );
              }

              const isOwner = String(msg.senderId) === String(authUser?.id);

              return (
                <div
                  key={msg._id}
                  className={`chat ${isOwner ? "chat-end" : "chat-start"}`}
                >
                  <div
                    className={`chat-bubble relative ${
                      isOwner
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-800 text-white"
                    }`}
                    onClick={() =>
                      isOwner &&
                      setActiveMenu(activeMenu === msg._id ? null : msg._id)
                    }
                  >
                    {/* 📸 نمایش عکس‌ها — شامل Base64 و URL */}
                    {msg.image && (
                      <div className="mt-1">
                        <img
                          src={
                            msg.image.startsWith("data:image")
                              ? msg.image // پیش‌نمایش Base64
                              : msg.image.startsWith("http")
                              ? msg.image // URL کامل
                              : `http://localhost:8000${msg.image}` // اصلاح مسیر نسبی
                          }
                          alt="Shared"
                          className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={() =>
                            window.open(
                              msg.image.startsWith("http")
                                ? msg.image
                                : `http://localhost:8000${msg.image}`,
                              "_blank"
                            )
                          }
                        />
                      </div>
                    )}

                    {/* 📝 نمایش متن پیام */}
                    {msg.text && (
                      <p className="mt-2 whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    )}

                    {/* ⏱️ زمان ارسال */}
                    <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                      {msg.createdAt instanceof Date
                        ? msg.createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "🕒"}
                    </p>

                    {/* ⚙️ منوی شناور فقط برای پیام خودت */}
                    {isOwner && activeMenu === msg._id && (
                      <div className="absolute top-0 right-0 bg-slate-700 rounded-md shadow-lg z-10 flex flex-col">
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
