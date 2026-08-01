import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import GroupCallModal from "./GroupCallModal";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import {
  XIcon,
  UsersIcon,
  PencilIcon,
  ShieldCheckIcon,
  CameraIcon,
  UserPlusIcon,
  Trash2,
  Check,
  FileTextIcon,
  MapPinIcon,
  DownloadIcon,
  Pin,
  Star,
  CheckIcon,
  PhoneIcon,
  VideoIcon,
} from "lucide-react";
import MessageContextMenu from "./MessageContextMenu";
import MessageInfoModal from "./MessageInfoModal";
import ForwardMessageModal from "./ForwardMessageModal";

const API_BASE_URL = "http://localhost:8000";
const resolveUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE_URL}${url}`);

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function GroupChatContainer({ group, onBack }) {
  // ✅ FIX: چک اعتبار group قبل از تمام هوک‌ها انجام نمی‌شه (نقض Rules of
  // Hooks) — به‌جاش groupId با optional chaining امن محاسبه می‌شه و
  // return null فقط بعد از تمام هوک‌ها (پایین فایل) اجرا می‌شه.
  const groupId = group?._id || group?.id;
  const accessToken = localStorage.getItem("accessToken");
  // ✅ FIX: قبلاً با JSON.parse(localStorage.getItem("authUser")) خونده
  // می‌شد که همیشه {} خالی برمی‌گردوند. از هوک useAuthStore می‌خونیم،
  // دقیقاً مثل ChatContainer.jsx (نسخه‌ی سالم چت خصوصی).
  const { authUser } = useAuthStore();

  const { allContacts, getAllContacts, onlineUsers } = useChatStore();
  // ✅ NEW: برای شروع/مدیریت تماس صوتی/تصویری گروهی
  const { startGroupCall, groupCallStatus, connectCallSocket } = useCallStore();

  const [localGroup, setLocalGroup] = useState(group || {});

  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [text, setText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [members, setMembers] = useState([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group?.name || "");
  const nameInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // ✅ NEW: ویرایش توضیحات گروه — دقیقاً همون الگوی ویرایش اسم گروه
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(group?.description || "");
  const descriptionInputRef = useRef(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const confirmRemoveTimerRef = useRef(null);

  // ✅ NEW: منوی کامل پیام (ریپلای/فوروارد/کپی/استار/پین/اطلاعات/ترجمه/ادیت/دیلیت)
  const [activeMenuData, setActiveMenuData] = useState(null); // { msg, senderName, isOwner, position }
  const [replyTarget, setReplyTarget] = useState(null); // { id, text, senderName }
  // ⚠️ استار و پین فعلاً فقط local هستن (با رفرش پاک می‌شن) چون بک‌اند
  // فیلدی براشون نداره — وقتی مدل پیام رو دیدم پایدارش می‌کنم
  const [starredIds, setStarredIds] = useState(new Set());
  const [pinnedMessageId, setPinnedMessageId] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [infoMessageData, setInfoMessageData] = useState(null);

  // ✅ NEW: برای long-press واقعی روی موبایل (که با contextmenu/کلیک ساده فرق داره)
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const isAdmin = localGroup.my_role === "admin" || localGroup.owner?.id === authUser?.id;

  useEffect(() => {
    if (!group) return;
    setLocalGroup(group);
    setEditedName(group.name || "");
    setEditedDescription(group.description || "");
    setPinnedMessageId(null);
  }, [group]);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  useEffect(() => {
    return () => {
      if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!groupId || !accessToken) return;
    setIsMembersLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/groups/members/?group=${groupId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Error fetching members:", err);
    } finally {
      setIsMembersLoading(false);
    }
  }, [groupId, accessToken]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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

      if (data.type === "user_event") {
        fetchMembers();
      }

      if (data.type === "error") {
        toast.error(data.message || "خطا در ارسال پیام");
      }

      // ✅ FIX: همگام‌سازی ویرایش/حذف که از سرور broadcast می‌شه (قبلاً اصلاً
      // هندل نمی‌شد چون بک‌اند هم این اکشن‌ها رو نداشت).
      if (data.type === "edit_message") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId ? { ...m, text: data.newText, edited: true } : m
          )
        );
      }

      if (data.type === "delete_message") {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }

      // ✅ NEW: پین/آن‌پین که یه عضو دیگه‌ی گروه انجام داده
      if (data.type === "pin_message") {
        setPinnedMessageId(data.pinned ? data.messageId : null);
      }

      // ✅ NEW: آپدیت لحظه‌ای نتیجه‌ی رأی‌گیری
      if (data.type === "poll_update") {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, meta: data.meta } : m))
        );
      }
    };

    socketRef.current.onerror = (err) => console.error("❌ WS Error:", err);
    socketRef.current.onclose = () => console.log("ℹ️ WS closed");

    return () => socketRef.current?.close();
  }, [groupId, accessToken, fetchMembers]);

  // -------------------------
  // دریافت پیام‌ها از API
  // -------------------------
  useEffect(() => {
    if (!groupId || !accessToken) {
      setIsMessagesLoading(false);
      return;
    }

    let isMounted = true;

    const fetchMessages = async () => {
      setIsMessagesLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/groups/groups/${groupId}/messages/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
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

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------
  // ارسال پیام — payload کامل (متن/عکس/فایل/لوکیشن/مخاطب)
  // -------------------------
  const sendMessage = async (payload = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("اتصال چت برقرار نیست، لطفاً صبر کن یا صفحه رو رفرش کن");
      return;
    }

    const finalText = payload.text !== undefined ? payload.text : textRef.current;
    const { image = null, file = null, fileName = null, messageType = "text", meta = null } = payload;

    if (!finalText?.trim() && !image && !file && !meta) return;

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
      JSON.stringify({
        action: "message",
        text: finalText,
        messageType,
        image: imageData,
        file: fileData,
        fileName: resolvedFileName,
        meta,
        // ⚠️ این فیلد رو فقط اگه بک‌اند توی سریالایزر/consumer قبولش کنه و
        // موقع broadcast برگردونه، توی پیام‌های بعدی دیده می‌شه
        replyTo: replyTarget
          ? { id: replyTarget.id, text: replyTarget.text, senderName: replyTarget.senderName }
          : null,
      })
    );

    setText("");
    setReplyTarget(null);
  };

  // ✅ NEW: رأی دادن به نظرسنجی گروه
  const votePoll = (messageId, optionId) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ action: "vote_poll", messageId, optionId }));
  };

  // -------------------------
  // ویرایش پیام (فقط نویسنده‌ی خودش) — واقعاً به سرور می‌فرسته
  // -------------------------
  const handleEditMessage = (messageId, newText) => {
    const trimmed = (newText || "").trim();
    if (!trimmed || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({ action: "edit_message", messageId, newText: trimmed })
    );
  };

  // -------------------------
  // حذف پیام (فقط نویسنده‌ی خودش) — واقعاً به سرور می‌فرسته
  // -------------------------
  const handleDeleteMessage = (messageId) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ action: "delete_message", messageId }));
  };

  // -------------------------
  // ✅ NEW: کپی متن پیام
  // -------------------------
  const handleCopy = (msg) => {
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text).then(
      () => toast.success("متن کپی شد"),
      () => toast.error("کپی ممکن نشد")
    );
  };

  // -------------------------
  // ✅ NEW: استار (local — فقط تا رفرش بعدی می‌مونه)
  // -------------------------
  const toggleStar = (msg) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id);
      else next.add(msg.id);
      return next;
    });
  };

  // -------------------------
  // ✅ پین (real-time بین اعضای گروه — تا رفرش بعدی می‌مونه، ذخیره دائم نمی‌شه)
  // -------------------------
  const togglePin = (msg) => {
    const willBePinned = pinnedMessageId !== msg.id;
    setPinnedMessageId(willBePinned ? msg.id : null);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ action: "pin_message", messageId: msg.id, pinned: willBePinned })
      );
    }
  };

  // -------------------------
  // ✅ NEW: ترجمه با یه سرویس عمومی — ممکنه به‌خاطر rate-limit شکست بخوره،
  // برای استفاده‌ی دائمی بهتره به یه API اختصاصی با کلید وصل بشه
  // -------------------------
  // -------------------------
  // ✅ ترجمه با MyMemory (رایگان، بدون نیاز به API key) — جهت رو با
  // تشخیص حروف فارسی خودکار تعیین می‌کنه
  // -------------------------
  const handleTranslate = async (msg) => {
    if (!msg.text) return;
    const loadingToast = toast.loading("در حال ترجمه...");
    try {
      const hasPersian = /[\u0600-\u06FF]/.test(msg.text);
      const langpair = hasPersian ? "fa|en" : "en|fa";
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(msg.text)}&langpair=${langpair}`
      );
      if (!res.ok) throw new Error("translate failed");
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (!translated) throw new Error("empty translation");
      toast.dismiss(loadingToast);
      toast(
        (t) => (
          <div className="text-sm">
            <p className="font-medium mb-1 text-cyan-400">ترجمه:</p>
            <p className="text-slate-100">{translated}</p>
          </div>
        ),
        { duration: 8000, style: { background: "#1e293b", color: "#fff", border: "1px solid #334155" } }
      );
    } catch (err) {
      console.error("خطای ترجمه:", err);
      toast.dismiss(loadingToast);
      toast.error("ترجمه ممکن نشد — دوباره امتحان کن");
    }
  };

  // -------------------------
  // ✅ NEW: باز کردن منوی پیام — از کلیک ساده، کلیک راست، و long-press
  // موبایل (contextmenu / تایمر تاچ) صدا زده می‌شه
  // -------------------------
  const openMessageMenu = (e, msg, senderName, isOwner) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    const position = {
      top: Math.min(clientY, window.innerHeight - 340),
      left: Math.min(clientX, window.innerWidth - 200),
    };
    setActiveMenuData((prev) => (prev?.msg.id === msg.id ? null : { msg, senderName, isOwner, position }));
  };

  const handleBubbleClick = (e, msg, senderName, isOwner) => {
    // اگه همین حالا از long-press تاچ باز شده، این کلیکِ بعد از رهاکردن انگشت رو نادیده بگیر
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    openMessageMenu(e, msg, senderName, isOwner);
  };

  const handleTouchStart = (e, msg, senderName, isOwner) => {
    longPressTriggeredRef.current = false;
    const touch = e.touches[0];
    if (!touch) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openMessageMenu({ clientX: touch.clientX, clientY: touch.clientY }, msg, senderName, isOwner);
      if (navigator.vibrate) navigator.vibrate(15); // لرزش کوتاه مثل واتساب
    }, 450);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  // -------------------------
  // ویرایش اسم گروه (فقط ادمین)
  // -------------------------
  useEffect(() => {
    if (isEditingName && nameInputRef.current) nameInputRef.current.focus();
  }, [isEditingName]);

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    setIsEditingName(false);
    if (!trimmed || trimmed === localGroup.name) return;

    try {
      const res = await axios.patch(
        `${API_BASE_URL}/groups/groups/${groupId}/`,
        { name: trimmed },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setLocalGroup((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error("❌ خطا در تغییر اسم گروه:", err.response?.data || err);
      setEditedName(localGroup.name || "");
    }
  };

  // -------------------------
  // ✅ NEW: ویرایش توضیحات گروه (فقط ادمین) — همون الگوی اسم گروه
  // -------------------------
  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) descriptionInputRef.current.focus();
  }, [isEditingDescription]);

  const handleSaveDescription = async () => {
    const trimmed = editedDescription.trim();
    setIsEditingDescription(false);
    if (trimmed === (localGroup.description || "")) return;

    try {
      const res = await axios.patch(
        `${API_BASE_URL}/groups/groups/${groupId}/`,
        { description: trimmed },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setLocalGroup((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error("❌ خطا در تغییر توضیحات گروه:", err.response?.data || err);
      setEditedDescription(localGroup.description || "");
    }
  };

  // -------------------------
  // ✅ NEW: شروع تماس صوتی/تصویری گروهی
  // -------------------------
  const canStartGroupCall = groupCallStatus === "idle";

  const startGroupCallWithType = (type) => {
    if (!canStartGroupCall) return;
    connectCallSocket();
    const myInfo = {
      name: authUser?.name || authUser?.email || "کاربر",
      image: authUser?.image || authUser?.profile || null,
    };
    startGroupCall({ id: groupId, name: localGroup.name }, myInfo, type);
  };

  const handleGroupAudioCall = () => startGroupCallWithType("audio");
  const handleGroupVideoCall = () => startGroupCallWithType("video");

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await axios.patch(`${API_BASE_URL}/groups/groups/${groupId}/`, formData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLocalGroup((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error("❌ خطا در تغییر عکس گروه:", err.response?.data || err);
    }
  };

  // -------------------------
  // افزودن عضو جدید
  // -------------------------
  const memberUserIds = new Set(members.map((m) => m.user));
  const availableContacts = allContacts.filter((c) => {
    const cid = Number(c._id || c.id);
    return !memberUserIds.has(cid);
  });

  const toggleNewMember = (contactId) => {
    setSelectedNewMemberIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const openAddMember = () => {
    setSelectedNewMemberIds([]);
    setShowAddMember(true);
  };

  const handleAddMembers = async () => {
    if (selectedNewMemberIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      await Promise.all(
        selectedNewMemberIds.map((contactId) =>
          axios
            .post(
              `${API_BASE_URL}/groups/members/`,
              { group: groupId, user: contactId, role: "member" },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            .catch((err) => console.warn("خطا در افزودن عضو:", err.response?.data || err))
        )
      );
      toast.success("اعضای جدید اضافه شدند");
      await fetchMembers();
      setShowAddMember(false);
      setSelectedNewMemberIds([]);
    } catch {
      toast.error("خطا در افزودن اعضا");
    } finally {
      setIsAddingMembers(false);
    }
  };

  // -------------------------
  // حذف عضو (فقط ادمین)
  // -------------------------
  const handleRemoveMemberClick = async (e, memberRecordId, isOwnerRow) => {
    e.stopPropagation();
    if (isOwnerRow) return;

    if (confirmRemoveId === memberRecordId) {
      if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
      setConfirmRemoveId(null);

      try {
        await axios.delete(`${API_BASE_URL}/groups/members/${memberRecordId}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setMembers((prev) => prev.filter((m) => m.id !== memberRecordId));
        toast.success("عضو حذف شد");
      } catch (err) {
        console.error("خطا در حذف عضو:", err.response?.data || err);
        toast.error("حذف عضو ممکن نشد");
      }
      return;
    }

    setConfirmRemoveId(memberRecordId);
    if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
    confirmRemoveTimerRef.current = setTimeout(() => {
      setConfirmRemoveId((current) => (current === memberRecordId ? null : current));
    }, 3000);
  };

  const resolveAvatarUrl = (avatar) => {
    if (!avatar) return "/avatar.png";
    return avatar.startsWith("http") ? avatar : `${API_BASE_URL}${avatar}`;
  };

  const resolveMemberAvatar = (image) => {
    if (!image) return "/avatar.png";
    return image.startsWith("http") ? image : `${API_BASE_URL}${image}`;
  };

  // -------------------------
  // ✅ NEW: رندر نظرسنجی (سؤال + گزینه‌ها با نوار درصد رأی)
  // -------------------------
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
                onClick={(e) => {
                  e.stopPropagation();
                  votePoll(msg.id, opt.id);
                }}
                className="w-full text-right relative overflow-hidden rounded-lg bg-black/20 hover:bg-black/30 transition-colors p-2"
              >
                <div className="absolute inset-y-0 right-0 bg-cyan-400/20" style={{ width: `${percent}%` }} />
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

  // -------------------------
  // محتوای پیام بسته به نوعش (لوکیشن/مخاطب/فایل/نظرسنجی)
  // -------------------------
  const renderMessageContent = (msg) => {
    const type = msg.messageType || msg.message_type || "text";

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

  // -------------------------
  // Header گروه
  // -------------------------
  const GroupChatHeader = () => (
    <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
      <button
        onClick={() => setShowInfoPanel(true)}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
          <img
            src={resolveAvatarUrl(localGroup.avatar)}
            alt={localGroup.name || "گروه"}
            className="object-cover w-full h-full"
            onError={(e) => (e.target.src = "/avatar.png")}
          />
        </div>
        <div className="text-right">
          <h1 className="text-slate-200 font-medium text-base">{localGroup.name}</h1>
          <p className="text-slate-400 text-xs">{isMembersLoading ? "..." : `${members.length} عضو`}</p>
        </div>
      </button>

      <div className="flex items-center gap-1">
        {/* ✅ NEW: تماس صوتی گروهی — دقیقاً همون استایل چت خصوصی */}
        <button
          onClick={handleGroupAudioCall}
          disabled={!canStartGroupCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-cyan-500/10 text-cyan-400
                     hover:bg-cyan-500/20 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-cyan-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title="تماس صوتی گروهی"
        >
          <PhoneIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        {/* ✅ NEW: تماس تصویری گروهی */}
        <button
          onClick={handleGroupVideoCall}
          disabled={!canStartGroupCall}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center
                     bg-violet-500/10 text-violet-400
                     hover:bg-violet-500/20 hover:shadow-[0_0_16px_rgba(167,139,250,0.35)]
                     active:scale-90
                     disabled:opacity-30 disabled:hover:bg-violet-500/10 disabled:hover:shadow-none disabled:active:scale-100
                     transition-all duration-200"
          title="تماس تصویری گروهی"
        >
          <VideoIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
        </button>

        <span className="w-px h-6 bg-slate-700/60 mx-1" />

        <button
          onClick={() => setShowInfoPanel(true)}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          title="اطلاعات گروه"
        >
          <UsersIcon className="w-5 h-5" />
        </button>
        <button onClick={onBack} className="p-2">
          <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
        </button>
      </div>
    </div>
  );

  // -------------------------
  // پنل اطلاعات گروه / اعضا (با وضعیت آنلاین)
  // -------------------------
  const GroupInfoPanel = () => {
    if (!showInfoPanel) return null;

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={() => setShowInfoPanel(false)}
      >
        <div
          className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
            <h3 className="text-slate-100 font-semibold text-base">اطلاعات گروه</h3>
            <button onClick={() => setShowInfoPanel(false)} className="text-slate-400 hover:text-white transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <div className="flex flex-col items-center gap-3 p-6 border-b border-slate-700/50">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-700">
                  <img
                    src={resolveAvatarUrl(localGroup.avatar)}
                    alt={localGroup.name}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.src = "/avatar.png")}
                  />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 left-0 bg-cyan-600 hover:bg-cyan-500 rounded-full p-1.5 border-2 border-slate-800 transition-colors"
                    title="تغییر عکس گروه"
                  >
                    <CameraIcon className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
              </div>

              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="bg-slate-900/60 border-b border-cyan-400 outline-none text-slate-100 text-lg font-semibold text-center px-2 py-1 rounded-t"
                />
              ) : (
                <div
                  className={`flex items-center gap-2 ${isAdmin ? "cursor-pointer group" : ""}`}
                  onClick={() => isAdmin && setIsEditingName(true)}
                >
                  <h2 className="text-slate-100 text-lg font-semibold">{localGroup.name}</h2>
                  {isAdmin && (
                    <PencilIcon className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              )}

              {/* ✅ NEW: توضیحات گروه حالا قابل ویرایشه (فقط ادمین) — دقیقاً الگوی اسم گروه */}
              {isEditingDescription ? (
                <textarea
                  ref={descriptionInputRef}
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={handleSaveDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveDescription();
                    }
                  }}
                  rows={2}
                  placeholder="توضیحاتی برای گروه بنویس..."
                  className="w-full bg-slate-900/60 border border-cyan-400/60 outline-none text-slate-300 text-sm text-center px-3 py-1.5 rounded-lg resize-none"
                />
              ) : isAdmin ? (
                <div
                  className="flex items-center gap-1.5 max-w-full px-2 cursor-pointer group/desc"
                  onClick={() => setIsEditingDescription(true)}
                >
                  <p
                    className={`text-sm text-center truncate ${
                      localGroup.description ? "text-slate-400" : "text-slate-600 italic"
                    }`}
                  >
                    {localGroup.description || "افزودن توضیحات..."}
                  </p>
                  <PencilIcon className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover/desc:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ) : (
                localGroup.description && (
                  <p className="text-slate-400 text-sm text-center">{localGroup.description}</p>
                )
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-slate-400 text-xs">
                  {isMembersLoading ? "در حال بارگذاری..." : `${members.length} عضو`}
                </p>
                <button
                  onClick={openAddMember}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
                >
                  <UserPlusIcon className="w-3.5 h-3.5" />
                  افزودن عضو
                </button>
              </div>

              <div className="space-y-1">
                {members.map((m) => {
                  const isOwnerRow = m.user === localGroup.owner?.id;
                  const isConfirmingRemove = confirmRemoveId === m.id;
                  const isOnline = onlineUsers.includes(String(m.user));

                  return (
                    <div
                      key={m.id}
                      className="group/member flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/40 transition-colors"
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                        <img
                          src={resolveMemberAvatar(m.user_detail?.image)}
                          alt={m.user_detail?.name}
                          className="w-full h-full object-cover"
                          onError={(e) => (e.target.src = "/avatar.png")}
                        />
                        {isOnline && (
                          <span
                            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-800"
                            title="آنلاین"
                          />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-slate-200 text-sm truncate">
                          {m.user_detail?.name || m.user_detail?.email}
                        </span>
                        <span className={`text-xs truncate ${isOnline ? "text-green-400" : "text-slate-500"}`}>
                          {isOnline ? "آنلاین" : m.user_detail?.email}
                        </span>
                      </div>

                      {m.role === "admin" && (
                        <span className="flex items-center gap-1 text-cyan-400 text-xs flex-shrink-0">
                          <ShieldCheckIcon className="w-3.5 h-3.5" />
                          ادمین
                        </span>
                      )}

                      {isAdmin && !isOwnerRow && (
                        <button
                          onClick={(e) => handleRemoveMemberClick(e, m.id, isOwnerRow)}
                          className={`flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ${
                            isConfirmingRemove
                              ? "bg-red-500 text-white w-16 h-7 opacity-100"
                              : "opacity-0 group-hover/member:opacity-100 w-7 h-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          }`}
                          title={isConfirmingRemove ? "تایید حذف" : "حذف از گروه"}
                        >
                          {isConfirmingRemove ? (
                            <span className="text-[10px] font-medium">مطمئنی؟</span>
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------
  // مودال افزودن عضو
  // -------------------------
  const AddMemberModal = () => {
    if (!showAddMember) return null;

    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={() => setShowAddMember(false)}
      >
        <div
          className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden border border-slate-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
            <h3 className="text-slate-100 font-semibold text-base">افزودن عضو به گروه</h3>
            <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-white transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-2">
            {availableContacts.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">همه‌ی مخاطبینت از قبل توی این گروه هستن</p>
            ) : (
              availableContacts.map((contact) => {
                const contactId = Number(contact._id || contact.id);
                const isSelected = selectedNewMemberIds.includes(contactId);

                const profilePic = contact.profile?.startsWith("http")
                  ? contact.profile
                  : contact.raw?.profile?.startsWith("http")
                  ? contact.raw.profile
                  : contact.raw?.profile
                  ? `${API_BASE_URL}${contact.raw.profile}`
                  : "/avatar.png";

                return (
                  <div
                    key={contactId}
                    onClick={() => toggleNewMember(contactId)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-cyan-600/20" : "hover:bg-slate-700/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                      <img
                        src={profilePic}
                        alt={contact.name}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target.src = "/avatar.png")}
                      />
                    </div>
                    <span className="text-slate-200 text-sm truncate flex-1">{contact.name}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-500"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {availableContacts.length > 0 && (
            <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
              <button
                onClick={handleAddMembers}
                disabled={selectedNewMemberIds.length === 0 || isAddingMembers}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isAddingMembers
                  ? "در حال افزودن..."
                  : selectedNewMemberIds.length > 0
                  ? `افزودن ${selectedNewMemberIds.length} نفر`
                  : "افزودن"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------
  // Render
  // -------------------------
  // ✅ FIX: چک نهایی بعد از تمام هوک‌ها
  if (!groupId) return null;

  return (
    <div className="flex flex-col h-full">
      <GroupChatHeader />
      <GroupInfoPanel />
      <AddMemberModal />
      <GroupCallModal />

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder name={localGroup.name} onQuickReply={(msg) => setText(msg)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* ✅ NEW: نوار پیام پین‌شده (local — تا رفرش بعدی) */}
            {pinnedMessageId &&
              (() => {
                const pinnedMsg = messages.find((m) => m.id === pinnedMessageId);
                if (!pinnedMsg) return null;
                return (
                  <div className="flex items-center gap-2 bg-slate-800/70 border border-cyan-500/30 rounded-lg px-3 py-2">
                    <Pin className="w-4 h-4 text-cyan-400 flex-shrink-0 fill-cyan-400" />
                    <p className="text-slate-300 text-xs truncate flex-1">
                      {pinnedMsg.text || "پیام پین‌شده"}
                    </p>
                    <button
                      onClick={() => setPinnedMessageId(null)}
                      className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}

            {messages.map((msg) => {
              // ✅ مقاوم در برابر sender/author چه آبجکت باشه چه عدد خام
              const rawSenderId = msg.sender?.id ?? msg.sender ?? msg.author?.id ?? msg.author;
              const isOwner =
                rawSenderId !== undefined &&
                rawSenderId !== null &&
                String(rawSenderId) === String(authUser?.id ?? "");
              const senderInfo = msg.sender || msg.author;
              const specialContent = renderMessageContent(msg);

              return (
                <div key={msg.id} className={`chat ${isOwner ? "chat-end" : "chat-start"}`}>
                  <div
                    className={`chat-bubble relative select-none ${
                      isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"
                    }`}
                    style={{ touchAction: "manipulation" }}
                    onClick={(e) => {
                      if (msg.messageType === "poll") return;
                      handleBubbleClick(e, msg, senderInfo?.name || senderInfo?.email || "", isOwner);
                    }}
                    onContextMenu={(e) => {
                      if (msg.messageType === "poll") return;
                      openMessageMenu(e, msg, senderInfo?.name || senderInfo?.email || "", isOwner);
                    }}
                    onTouchStart={(e) => {
                      if (msg.messageType === "poll") return;
                      handleTouchStart(e, msg, senderInfo?.name || senderInfo?.email || "", isOwner);
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    {!isOwner && (
                      <p className="text-xs text-cyan-300 mb-1">{senderInfo?.name || senderInfo?.email}</p>
                    )}

                    {msg.replyTo && (
                      <div className="mb-1.5 border-r-2 border-cyan-300/60 bg-black/15 rounded px-2 py-1">
                        <p className="text-[11px] text-cyan-200 font-medium">{msg.replyTo.senderName || "پیام"}</p>
                        <p className="text-[11px] opacity-80 truncate max-w-[220px]">{msg.replyTo.text}</p>
                      </div>
                    )}

                    {msg.image && (
                      <div className="mt-1">
                        <img
                          src={resolveUrl(msg.image)}
                          alt="Shared"
                          className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(resolveUrl(msg.image), "_blank");
                          }}
                        />
                      </div>
                    )}

                    {specialContent && <div className="mt-1">{specialContent}</div>}

                    {msg.text && <p className="whitespace-pre-wrap break-words mt-1">{msg.text}</p>}

                    <p className="text-xs opacity-70 mt-1 flex items-center gap-1 justify-end">
                      {starredIds.has(msg.id) && (
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      )}
                      {new Date(msg.created_at || msg.created_date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
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
        sendMessage={sendMessage}
        editMessage={handleEditMessage}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />

      {/* ✅ NEW: منوی کامل پیام + مودال‌های فوروارد و اطلاعات */}
      <MessageContextMenu
        isOpen={!!activeMenuData}
        onClose={() => setActiveMenuData(null)}
        position={activeMenuData?.position}
        isOwner={activeMenuData?.isOwner}
        hasText={!!activeMenuData?.msg?.text?.trim()}
        isStarred={activeMenuData ? starredIds.has(activeMenuData.msg.id) : false}
        isPinned={activeMenuData ? pinnedMessageId === activeMenuData.msg.id : false}
        onReply={() =>
          setReplyTarget({
            id: activeMenuData.msg.id,
            text:
              activeMenuData.msg.text ||
              (activeMenuData.msg.image
                ? "عکس"
                : activeMenuData.msg.file
                ? activeMenuData.msg.fileName || "فایل"
                : ""),
            senderName: activeMenuData.senderName,
          })
        }
        onForward={() => setForwardMessage(activeMenuData.msg)}
        onCopy={activeMenuData?.msg?.text ? () => handleCopy(activeMenuData.msg) : undefined}
        onToggleStar={() => toggleStar(activeMenuData.msg)}
        onTogglePin={() => togglePin(activeMenuData.msg)}
        onTranslate={activeMenuData?.msg?.text ? () => handleTranslate(activeMenuData.msg) : undefined}
        onInfo={() => setInfoMessageData({ msg: activeMenuData.msg, senderName: activeMenuData.senderName })}
        onEdit={
          activeMenuData?.isOwner && activeMenuData?.msg?.text
            ? () => {
                setEditingMessageId(activeMenuData.msg.id);
                setEditingText(activeMenuData.msg.text);
              }
            : undefined
        }
        onDelete={activeMenuData?.isOwner ? () => handleDeleteMessage(activeMenuData.msg.id) : undefined}
      />

      <ForwardMessageModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />

      <MessageInfoModal
        isOpen={!!infoMessageData}
        onClose={() => setInfoMessageData(null)}
        data={infoMessageData}
      />
    </div>
  );
}

export default GroupChatContainer;