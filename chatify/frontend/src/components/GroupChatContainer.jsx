import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
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
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

function GroupChatContainer({ group, onBack }) {
  // ✅ FIX: قبلاً اینجا یه `if (!group...) return null;` بود که قبل از تمام
  // هوک‌ها اجرا می‌شد. این کار Rules of Hooks رو نقض می‌کنه: بین رندرها
  // تعداد/ترتیب هوک‌های صدا زده شده فرق می‌کرد (وقتی مقدار group عوض می‌شد)
  // و همین باعث می‌شد React نتونه state رو درست نگه‌داری کنه و کل پنل
  // (هدر، پیام‌ها، اینپوت) اصلاً رندر نشه یا خراب رندر بشه.
  // راه‌حل: از optional chaining استفاده کن تا وقتی group نال/آندیفایند هست
  // هم کرش نکنه، و return null رو ببر بعد از همه‌ی هوک‌ها (پایین فایل).
  const groupId = group?._id || group?.id;
  const accessToken = localStorage.getItem("accessToken");
  const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");

  const { allContacts, getAllContacts } = useChatStore();

  // ---- اطلاعات گروه (قابل آپدیت بعد از ویرایش) ----
  const [localGroup, setLocalGroup] = useState(group || {});

  // ---- پیام‌ها ----
  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [text, setText] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);

  // ---- پنل اطلاعات گروه / اعضا ----
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [members, setMembers] = useState([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  // ---- ویرایش اسم گروه (فقط ادمین) ----
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group?.name || "");
  const nameInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // ---- افزودن عضو ----
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // ---- حذف عضو ----
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const confirmRemoveTimerRef = useRef(null);

  const isAdmin = localGroup.my_role === "admin" || localGroup.owner?.id === authUser?.id;

  useEffect(() => {
    if (!group) return;
    setLocalGroup(group);
    setEditedName(group.name || "");
  }, [group]);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  useEffect(() => {
    return () => {
      if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
    };
  }, []);

  // -------------------------
  // دریافت اعضای گروه از API
  // -------------------------
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

      // ✅ FIX: بک‌اند الان وقتی پیام رد می‌شه (مثلاً چون کاربر عضو گروه نیست)
      // یه پیام type=error برمی‌گردونه. قبلاً این حالت اصلاً هندل نمی‌شد و
      // کاربر هیچ فیدبکی نمی‌گرفت که چرا پیامش نرفت.
      if (data.type === "error") {
        toast.error(data.message || "ارسال پیام با خطا مواجه شد");
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
        const res = await axios.get(
          `${API_BASE_URL}/groups/groups/${groupId}/messages/`,
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
  // ویرایش عکس گروه (فقط ادمین)
  // -------------------------
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
  // افزودن عضو جدید (از بین مخاطبین)
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
    } catch (err) {
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
          <p className="text-slate-400 text-xs">
            {isMembersLoading ? "..." : `${members.length} عضو`}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-1">
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
  // پنل اطلاعات گروه / اعضا
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
            <button
              onClick={() => setShowInfoPanel(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* آواتار و اسم گروه */}
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
                <input
                  type="file"
                  accept="image/*"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
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

              {localGroup.description && (
                <p className="text-slate-400 text-sm text-center">{localGroup.description}</p>
              )}
            </div>

            {/* لیست اعضا */}
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

                  return (
                    <div
                      key={m.id}
                      className="group/member flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                        <img
                          src={resolveMemberAvatar(m.user_detail?.image)}
                          alt={m.user_detail?.name}
                          className="w-full h-full object-cover"
                          onError={(e) => (e.target.src = "/avatar.png")}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-slate-200 text-sm truncate">
                          {m.user_detail?.name || m.user_detail?.email}
                        </span>
                        <span className="text-slate-500 text-xs truncate">{m.user_detail?.email}</span>
                      </div>

                      {m.role === "admin" && (
                        <span className="flex items-center gap-1 text-cyan-400 text-xs flex-shrink-0">
                          <ShieldCheckIcon className="w-3.5 h-3.5" />
                          ادمین
                        </span>
                      )}

                      {/* ✅ دکمه‌ی حذف عضو — فقط ادمین می‌بینه، و برای خود سازنده غیرفعاله */}
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
            <button
              onClick={() => setShowAddMember(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-2">
            {availableContacts.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">
                همه‌ی مخاطبینت از قبل توی این گروه هستن
              </p>
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
  // ✅ FIX: این‌جا، بعد از تمام هوک‌ها، چک می‌کنیم گروه معتبره یا نه.
  if (!groupId) return null;

  return (
    <div className="flex flex-col h-full">
      <GroupChatHeader />
      <GroupInfoPanel />
      <AddMemberModal />

      {/* پیام‌ها */}
      <div className="flex-1 px-6 overflow-y-auto py-8">
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <NoChatHistoryPlaceholder name={localGroup.name} onQuickReply={(msg) => setText(msg)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              // ✅ FIX: مقایسه رو type-safe کردیم (مثلاً اگه یکی id رو به شکل
              // string و اون یکی number ذخیره کرده باشه، قبلاً false می‌شد
              // حتی برای پیام‌های خود کاربر).
              const isOwner =
                String(msg.sender?.id ?? msg.author?.id ?? "") === String(authUser?.id ?? "");
              const senderInfo = msg.sender || msg.author;
              return (
                <div key={msg.id} className={`chat ${isOwner ? "chat-end" : "chat-start"}`}>
                  <div
                    className={`chat-bubble relative ${isOwner ? "bg-cyan-600 text-white" : "bg-gray-800 text-white"}`}
                    onClick={() => isOwner && setActiveMenu(activeMenu === msg.id ? null : msg.id)}
                  >
                    {!isOwner && (
                      <p className="text-xs text-cyan-300 mb-1">
                        {senderInfo?.name || senderInfo?.email}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at || msg.created_date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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