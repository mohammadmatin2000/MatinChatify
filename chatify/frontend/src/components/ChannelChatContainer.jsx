import { useEffect, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useChannelStore } from "../store/useChannelStore";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import { XIcon, Radio, UsersIcon, UserPlusIcon, ShieldCheckIcon } from "lucide-react";

const API_BASE_URL = "http://localhost:8000";
const resolveUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE_URL}${url}`);

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function ChannelChatContainer({ channel, onBack }) {
  const channelId = channel?.id;
  const accessToken = localStorage.getItem("accessToken");
  const { authUser } = useAuthStore();
  const { members, fetchMembers, isMembersLoading, addMember } = useChannelStore();

  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [text, setText] = useState("");
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const isAdmin = channel?.my_role === "admin";

  useEffect(() => {
    if (channelId) fetchMembers(channelId);
  }, [channelId, fetchMembers]);

  // اتصال WebSocket
  useEffect(() => {
    if (!channelId || !accessToken) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.hostname}:8000/ws/channels/${channelId}/?token=${accessToken}`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "message") {
        setMessages((prev) => [...prev, data]);
      }
      if (data.type === "error") {
        toast.error(data.message || "خطا در ارسال پیام");
      }
      if (data.type === "delete_message") {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
      if (data.type === "edit_message") {
        setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, text: data.newText } : m)));
      }
    };

    socketRef.current.onerror = (err) => console.error("❌ Channel WS error:", err);

    return () => socketRef.current?.close();
  }, [channelId, accessToken]);

  // گرفتن تاریخچه‌ی پیام‌ها
  useEffect(() => {
    if (!channelId || !accessToken) return;
    let isMounted = true;
    setIsMessagesLoading(true);

    axios
      .get(`${API_BASE_URL}/chchannels/channels/${channelId}/messages/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        if (isMounted) setMessages(res.data);
      })
      .catch((err) => console.error("❌ خطا در گرفتن پیام‌های چنل:", err))
      .finally(() => {
        if (isMounted) setIsMessagesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [channelId, accessToken]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (payload = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("اتصال چنل برقرار نیست");
      return;
    }
    const finalText = payload.text !== undefined ? payload.text : textRef.current;
    const { image = null, file = null, fileName = null, messageType = "text" } = payload;

    if (!finalText?.trim() && !image && !file) return;

    let imageData = null;
    if (image instanceof File) imageData = await fileToBase64(image);
    else if (typeof image === "string") imageData = image;

    let fileData = null;
    let resolvedFileName = fileName;
    if (file instanceof File) {
      fileData = await fileToBase64(file);
      resolvedFileName = fileName || file.name;
    } else if (typeof file === "string") {
      fileData = file;
    }

    socketRef.current.send(
      JSON.stringify({ action: "message", text: finalText, messageType, image: imageData, file: fileData, fileName: resolvedFileName })
    );
    setText("");
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!/^09\d{9}$/.test(addPhone)) {
      toast.error("شماره موبایل معتبر نیست.");
      return;
    }
    setIsAdding(true);
    const success = await addMember({ channelId, phoneNumber: addPhone, role: "subscriber" });
    setIsAdding(false);
    if (success) setAddPhone("");
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(channel.invite_code);
    toast.success("کد دعوت کپی شد");
  };

  if (!channelId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
        <button onClick={() => setShowInfoPanel(true)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center overflow-hidden flex-shrink-0">
            {channel.image ? (
              <img src={resolveUrl(channel.image)} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <Radio className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="text-right">
            <h1 className="text-slate-200 font-medium text-base flex items-center gap-1.5">
              {channel.name}
              <Radio className="w-3.5 h-3.5 text-violet-400" />
            </h1>
            <p className="text-slate-400 text-xs">
              {isMembersLoading ? "..." : `${members.length} عضو`} {isAdmin && "· تو ادمینی"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowInfoPanel(true)} className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title="اطلاعات چنل">
            <UsersIcon className="w-5 h-5" />
          </button>
          <button onClick={onBack} className="p-2">
            <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
          </button>
        </div>
      </div>

      {/* پیام‌ها */}
      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">هنوز پیامی توی این چنل ارسال نشده</p>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              const senderInfo = msg.sender;
              return (
                <div key={msg.id} className="chat chat-start">
                  <div className="chat-bubble bg-gray-800 text-white">
                    <p className="text-xs text-violet-300 mb-1 flex items-center gap-1">
                      {senderInfo?.name || senderInfo?.email || senderInfo?.phone_number}
                      <ShieldCheckIcon className="w-3 h-3" />
                    </p>
                    {msg.image && (
                      <img src={resolveUrl(msg.image)} alt="Shared" className="rounded-lg max-h-64 object-contain mb-1" />
                    )}
                    {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                    <p className="text-xs opacity-70 mt-1 text-left">
                      {new Date(msg.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      {/* ورودی پیام - فقط ادمین */}
      {isAdmin ? (
        <MessageInput text={text} setText={setText} sendMessage={sendMessage} />
      ) : (
        <div className="p-4 border-t border-slate-700/50 text-center text-slate-500 text-sm">
          فقط ادمین‌های این چنل می‌تونن پیام بذارن
        </div>
      )}

      {/* پنل اطلاعات چنل / اعضا */}
      {showInfoPanel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowInfoPanel(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
              <h3 className="text-slate-100 font-semibold text-base">اطلاعات چنل</h3>
              <button onClick={() => setShowInfoPanel(false)} className="text-slate-400 hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {channel.description && <p className="text-slate-400 text-sm text-center mb-4">{channel.description}</p>}

              {/* کد دعوت - فقط ادمین و فقط چنل عمومی */}
              {isAdmin && channel.is_public && (
                <div className="mb-4 bg-slate-900/40 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1.5">کد دعوت (فقط برای چنل‌های عمومی)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-slate-300 text-xs bg-slate-950/60 rounded px-2 py-1.5 truncate" dir="ltr">
                      {channel.invite_code}
                    </code>
                    <button
                      onClick={handleCopyInviteCode}
                      className="text-violet-400 hover:text-violet-300 text-xs font-medium flex-shrink-0"
                    >
                      کپی
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-slate-400 text-xs">{isMembersLoading ? "..." : `${members.length} عضو`}</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember((v) => !v)}
                    className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
                  >
                    <UserPlusIcon className="w-3.5 h-3.5" />
                    افزودن عضو
                  </button>
                )}
              </div>

              {showAddMember && (
                <form onSubmit={handleAddMemberSubmit} className="flex gap-2 mb-3">
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="09123456789"
                    dir="ltr"
                    className="flex-1 bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs px-3 rounded-lg transition-colors"
                  >
                    افزودن
                  </button>
                </form>
              )}

              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/40 transition-colors">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                      <img
                        src={m.profile ? resolveUrl(m.profile) : "/avatar.png"}
                        alt={m.name}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target.src = "/avatar.png")}
                      />
                    </div>
                    <span className="text-slate-200 text-sm truncate flex-1">{m.name}</span>
                    {m.role === "admin" && (
                      <span className="flex items-center gap-1 text-violet-400 text-xs flex-shrink-0">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        ادمین
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChannelChatContainer;