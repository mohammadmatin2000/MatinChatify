import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useChannelStore } from "../store/useChannelStore";
import { useSettingsStore } from "../store/useSettingsStore";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import ForwardMessageModal from "./ForwardMessageModal";
import useTranslation from "../hooks/useTranslation";
import {
    XIcon, Radio, UsersIcon, UserPlusIcon, ShieldCheckIcon,
    MoreVertical, Trash2, ShieldMinus, Search,
    FileTextIcon, MapPinIcon, DownloadIcon, CheckIcon,
    Link2Icon, Share2Icon, GlobeIcon, LockIcon,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";
const resolveUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE_URL}${url}`);

// ✅ NEW: نگاشت گزینه‌ی پس‌زمینه‌ی انتخاب‌شده در تنظیمات به کلاس واقعی Tailwind
const WALLPAPER_CLASSES = {
    default: "",
    midnight: "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950",
    aurora:
        "bg-slate-950 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.16),transparent_45%),radial-gradient(circle_at_85%_5%,rgba(168,85,247,0.14),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.12),transparent_50%)]",
    sunset: "bg-gradient-to-br from-orange-950/50 via-slate-900 to-rose-950/40",
    ocean: "bg-gradient-to-br from-cyan-950/60 via-slate-900 to-blue-950/40",
    forest: "bg-gradient-to-br from-emerald-950/60 via-slate-900 to-teal-950/30",
    grid: "bg-slate-950 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[length:24px_24px]",
    dots: "bg-slate-950 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:18px_18px]",
    candy: "bg-gradient-to-br from-fuchsia-950/50 via-slate-900 to-indigo-950/50",
    amber: "bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950",
    starry:
        "bg-slate-950 bg-[radial-gradient(1.5px_1.5px_at_20px_30px,rgba(255,255,255,0.5),transparent),radial-gradient(1.5px_1.5px_at_90px_60px,rgba(255,255,255,0.4),transparent),radial-gradient(1px_1px_at_150px_20px,rgba(255,255,255,0.35),transparent),radial-gradient(1.5px_1.5px_at_50px_100px,rgba(255,255,255,0.3),transparent)] bg-[length:180px_180px]",
    diagonal:
        "bg-slate-950 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.06)_0px,rgba(148,163,184,0.06)_1px,transparent_1px,transparent_14px)]",
    monochrome: "bg-slate-900",
};

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

function ChannelChatContainer({channel, onBack}) {
    const channelId = channel?.id;
    const accessToken = localStorage.getItem("accessToken");
    const {authUser} = useAuthStore();
    const {searchResults, isSearching, searchUsers, clearSearch} = useChatStore();
    const {members, fetchMembers, isMembersLoading, addMember, updateMemberRole, removeMember} = useChannelStore();
    const {t} = useTranslation();

    // ✅ NEW: پس‌زمینه‌ی چت از تنظیمات
    const chatWallpaper = useSettingsStore((state) => state.chatWallpaper);
    const wallpaperClass = WALLPAPER_CLASSES[chatWallpaper] || "";

    const [messages, setMessages] = useState([]);
    const [isMessagesLoading, setIsMessagesLoading] = useState(true);
    const [text, setText] = useState("");
    const socketRef = useRef(null);
    const messageEndRef = useRef(null);
    const textRef = useRef(text);
    textRef.current = text;

    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [addMemberTab, setAddMemberTab] = useState("phone");
    const [addPhone, setAddPhone] = useState("");
    const [addQuery, setAddQuery] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [addingId, setAddingId] = useState(null);
    const [openMenuMemberId, setOpenMenuMemberId] = useState(null);
    const debounceRef = useRef(null);

    const [isPublicLocal, setIsPublicLocal] = useState(!!channel?.is_public);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
    const [shareAsMessage, setShareAsMessage] = useState(null);

    useEffect(() => {
        setIsPublicLocal(!!channel?.is_public);
    }, [channel?.id, channel?.is_public]);

    const isAdmin = channel?.my_role === "admin";

    const inviteLink = channel?.invite_code
        ? `${window.location.origin}/join/${channel.invite_code}`
        : null;

    useEffect(() => {
        if (channelId && isAdmin) fetchMembers(channelId);
    }, [channelId, isAdmin, fetchMembers]);

    useEffect(() => {
        if (!channelId || !accessToken) return;

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${protocol}://${window.location.hostname}:8000/ws/channels/${channelId}/?token=${accessToken}`;
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === "message") setMessages((prev) => [...prev, data]);
            if (data.type === "error") toast.error(data.message || t("channel.sendError"));
            if (data.type === "delete_message") setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
            if (data.type === "edit_message")
                setMessages((prev) => prev.map((m) => (m.id === data.messageId ? {...m, text: data.newText} : m)));
            if (data.type === "poll_update")
                setMessages((prev) => prev.map((m) => (m.id === data.messageId ? {...m, meta: data.meta} : m)));
        };

        socketRef.current.onopen = () => {
            console.log("✅ Channel WS Connected");
        };

        socketRef.current.onclose = (e) => {
            console.log("❌ WS Closed");
            console.log("Code:", e.code);
            console.log("Reason:", e.reason);
        };

        socketRef.current.onerror = (e) => {
            console.log("❌ WS Error:", e);
        };

        return () => socketRef.current?.close();
    }, [channelId, accessToken]);

    useEffect(() => {
        if (!channelId || !accessToken) return;
        let isMounted = true;
        setIsMessagesLoading(true);

        axios
            .get(`${API_BASE_URL}/channels/channels/${channelId}/messages/`, {
                headers: {Authorization: `Bearer ${accessToken}`},
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
        messageEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    const sendMessage = async (payload = {}) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            toast.error(t("channel.noConnection"));
            return;
        }
        const finalText = payload.text !== undefined ? payload.text : textRef.current;
        const {image = null, file = null, fileName = null, messageType = "text", meta = null} = payload;

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
            })
        );
        setText("");
    };

    const votePoll = (messageId, optionId) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({action: "vote_poll", messageId, optionId}));
    };

    const handleAddByPhone = async (e) => {
        e.preventDefault();
        if (!/^09\d{9}$/.test(addPhone)) {
            toast.error(t("channel.invalidPhone"));
            return;
        }
        setIsAdding(true);
        const success = await addMember({channelId, phoneNumber: addPhone, role: "subscriber"});
        setIsAdding(false);
        if (success) setAddPhone("");
    };

    const handleAddQueryChange = useCallback(
        (value) => {
            setAddQuery(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => searchUsers(value), 350);
        },
        [searchUsers]
    );

    const handleAddByEmail = async (user) => {
        setAddingId(user.id);
        await addMember({channelId, userId: user.id, role: "subscriber"});
        setAddingId(null);
    };

    const openAddMember = () => {
        setAddMemberTab("phone");
        setAddPhone("");
        setAddQuery("");
        clearSearch();
        setShowAddMember(true);
    };

    const closeAddMember = () => {
        setShowAddMember(false);
        setAddPhone("");
        setAddQuery("");
        clearSearch();
    };

    const handlePromote = async (member) => {
        setOpenMenuMemberId(null);
        await updateMemberRole(channelId, member.id, "admin");
    };

    const handleDemote = async (member) => {
        setOpenMenuMemberId(null);
        await updateMemberRole(channelId, member.id, "subscriber");
    };

    const handleRemove = async (member) => {
        setOpenMenuMemberId(null);
        await removeMember(channelId, member.id);
    };

    const handleCopyInviteCode = () => {
        navigator.clipboard.writeText(channel.invite_code);
        toast.success(t("channel.codeCopied"));
    };

    const handleShareInvite = () => {
        if (!channel?.invite_code) return;
        setShareAsMessage({ text: channel.invite_code, messageType: "text" });
    };

    const handleToggleVisibility = async () => {
        if (isTogglingVisibility) return;
        const nextValue = !isPublicLocal;
        setIsTogglingVisibility(true);
        try {
            await axios.patch(
                `${API_BASE_URL}/channels/channels/${channelId}/`,
                {is_public: nextValue},
                {headers: {Authorization: `Bearer ${accessToken}`}}
            );
            setIsPublicLocal(nextValue);
            toast.success(nextValue ? t("channel.becamePublic") : t("channel.becamePrivate"));
        } catch (err) {
            console.error("❌ خطا در تغییر وضعیت چنل:", err);
            toast.error(t("channel.visibilityFailed"));
        } finally {
            setIsTogglingVisibility(false);
        }
    };

    const renderMessageContent = (msg) => {
        const type = msg.messageType || msg.message_type || "text";

        if (type === "voice" && msg.file) {
            return <audio controls src={resolveUrl(msg.file)} className="max-w-[240px] h-10"/>;
        }

        if (type === "video_note" && msg.file) {
            return (
                <video src={resolveUrl(msg.file)} controls className="w-40 h-40 rounded-full object-cover"/>
            );
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
                    <MapPinIcon className="w-5 h-5 flex-shrink-0"/>
                    <span className="text-sm">{t("location.viewOnMap")}</span>
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

        if (type === "poll" && msg.meta?.options) {
            const {question, options = []} = msg.meta;
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
                                    type="button"
                                    onClick={() => votePoll(msg.id, opt.id)}
                                    className="relative overflow-hidden rounded-lg bg-black/20 hover:bg-black/30 p-2 w-full text-right transition-colors"
                                >
                                    <div className="absolute inset-y-0 right-0 bg-violet-400/20"
                                         style={{width: `${percent}%`}}/>
                                    <div className="relative flex items-center justify-between gap-2">
                    <span className="text-sm flex items-center gap-1.5">
                      {hasVoted && <CheckIcon className="w-3.5 h-3.5 text-violet-300"/>}
                        {opt.text}
                    </span>
                                        <span className="text-xs opacity-70 flex-shrink-0">{percent}%</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs opacity-60 mt-1.5">{t("poll.totalVotes", { count: totalVotes })}</p>
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
                    <FileTextIcon className="w-5 h-5 flex-shrink-0"/>
                    <span className="text-sm truncate max-w-[180px]">{msg.fileName || msg.file_name || t("chatsList.file")}</span>
                    <DownloadIcon className="w-4 h-4 flex-shrink-0 opacity-70"/>
                </a>
            );
        }

        return null;
    };

    if (!channelId) return null;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div
                className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
                <button onClick={() => setShowInfoPanel(true)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {channel.image ? (
                            <img src={resolveUrl(channel.image)} alt={channel.name}
                                 className="w-full h-full object-cover"/>
                        ) : (
                            <Radio className="w-5 h-5 text-white"/>
                        )}
                    </div>
                    <div className="text-right">
                        <h1 className="text-slate-200 font-medium text-base flex items-center gap-1.5">
                            {channel.name}
                            <Radio className="w-3.5 h-3.5 text-violet-400"/>
                        </h1>
                        <p className="text-slate-400 text-xs">
                            {t("channelsList.membersCount", { count: channel.members_count ?? 0 })}
                            {isAdmin && ` · ${t("channel.youAreAdmin")}`}
                        </p>
                    </div>
                </button>

                <div className="flex items-center gap-1">
                    <button onClick={() => setShowInfoPanel(true)}
                            className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title={t("channel.info")}>
                        <UsersIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={onBack} className="p-2">
                        <XIcon
                            className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"/>
                    </button>
                </div>
            </div>

            {/* پیام‌ها */}
            {/* ✅ NEW: پس‌زمینه‌ی چت از تنظیمات اعمال می‌شه */}
            <div className={`flex-1 px-6 overflow-y-auto py-8 ${wallpaperClass}`}>
                {isMessagesLoading ? (
                    <MessagesLoadingSkeleton/>
                ) : messages.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-12">{t("channel.noMessages")}</p>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-4">
                        {messages.map((msg) => {
                            const senderInfo = msg.sender;
                            const specialContent = renderMessageContent(msg);

                            return (
                                <div key={msg.id} className="chat chat-start">
                                    <div className="chat-bubble bg-gray-800 text-white">
                                        <p className="text-xs text-violet-300 mb-1 flex items-center gap-1">
                                            {senderInfo?.name || senderInfo?.email || senderInfo?.phone_number}
                                            <ShieldCheckIcon className="w-3 h-3"/>
                                        </p>

                                        {msg.image && (
                                            <img src={resolveUrl(msg.image)} alt="Shared"
                                                 className="rounded-lg max-h-64 object-contain mb-1"/>
                                        )}

                                        {specialContent && <div className="mb-1">{specialContent}</div>}

                                        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                                        <p className="text-xs opacity-70 mt-1 text-left">
                                            {new Date(msg.created_date).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messageEndRef}/>
                    </div>
                )}
            </div>

            {isAdmin ? (
                <MessageInput text={text} setText={setText} sendMessage={sendMessage}/>
            ) : (
                <div className="p-4 border-t border-slate-700/50 text-center text-slate-500 text-sm">
                    {t("channel.onlyAdminsCanPost")}
                </div>
            )}

            {/* پنل اطلاعات چنل */}
            {showInfoPanel && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowInfoPanel(false)}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                            <h3 className="text-slate-100 font-semibold text-base">{t("channel.info")}</h3>
                            <button onClick={() => setShowInfoPanel(false)}
                                    className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4">
                            {channel.description &&
                                <p className="text-slate-400 text-sm text-center mb-4">{channel.description}</p>}

                            {isAdmin && (
                                <div className="flex items-center justify-between gap-3 bg-slate-900/40 rounded-2xl p-3.5 mb-4">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                isPublicLocal ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/60 text-slate-400"
                                            }`}
                                        >
                                            {isPublicLocal ? <GlobeIcon className="w-4 h-4"/> : <LockIcon className="w-4 h-4"/>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-slate-100 text-sm font-medium">
                                                {isPublicLocal ? t("channel.publicTitle") : t("channel.privateTitle")}
                                            </p>
                                            <p className="text-slate-500 text-[11px] truncate">
                                                {isPublicLocal
                                                    ? t("channel.publicDesc")
                                                    : t("channel.privateDesc")}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleToggleVisibility}
                                        disabled={isTogglingVisibility}
                                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                                            isPublicLocal ? "bg-violet-600" : "bg-slate-600"
                                        }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                                isPublicLocal ? "translate-x-[-22px]" : "translate-x-[-2px]"
                                            }`}
                                            style={{right: 0}}
                                        />
                                    </button>
                                </div>
                            )}

                            {isAdmin && channel.invite_code && isPublicLocal && (
                                <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/10 to-slate-900/40 p-4 mb-4">
                                    <div
                                        className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-violet-500/20 blur-2xl pointer-events-none"/>

                                    <div className="relative flex items-center gap-2.5 mb-3">
                                        <div
                                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
                                            <Link2Icon className="w-4 h-4 text-white"/>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-slate-100 text-sm font-semibold">{t("channel.inviteLinkTitle")}</p>
                                            <p className="text-slate-400 text-[11px] truncate">{t("channel.inviteLinkDesc")}</p>
                                        </div>
                                    </div>

                                    <div className="relative flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-slate-500 text-[11px] flex-shrink-0">{t("channel.codeLabel")}</span>
                                            <code
                                                className="text-slate-200 text-xs font-mono tracking-wider bg-slate-900/60 px-2 py-0.5 rounded truncate"
                                                dir="ltr">
                                                {channel.invite_code}
                                            </code>
                                            <button
                                                onClick={handleCopyInviteCode}
                                                className="text-violet-400 hover:text-violet-300 text-[11px] font-medium transition-colors flex-shrink-0"
                                            >
                                                {t("common.copy")}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleShareInvite}
                                            className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                                        >
                                            <Share2Icon className="w-3.5 h-3.5"/>
                                            {t("common.share")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isAdmin ? (
                                <>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <p className="text-slate-400 text-xs">
                                            {isMembersLoading ? t("common.loading") : t("channelsList.membersCount", { count: members.length })}
                                        </p>
                                        <button
                                            onClick={openAddMember}
                                            className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
                                        >
                                            <UserPlusIcon className="w-3.5 h-3.5"/>
                                            {t("member.add")}
                                        </button>
                                    </div>

                                    {showAddMember && (
                                        <div className="mb-3 bg-slate-900/40 rounded-lg overflow-hidden">
                                            <div className="flex border-b border-slate-700/50">
                                                <button
                                                    onClick={() => setAddMemberTab("phone")}
                                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                                        addMemberTab === "phone" ? "text-violet-400 border-b-2 border-violet-400" : "text-slate-400"
                                                    }`}
                                                >
                                                    {t("addMember.byPhone")}
                                                </button>
                                                <button
                                                    onClick={() => setAddMemberTab("email")}
                                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                                        addMemberTab === "email" ? "text-violet-400 border-b-2 border-violet-400" : "text-slate-400"
                                                    }`}
                                                >
                                                    {t("addMember.byEmail")}
                                                </button>
                                                <button onClick={closeAddMember}
                                                        className="px-3 text-slate-500 hover:text-slate-300">
                                                    <XIcon className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>

                                            {addMemberTab === "phone" && (
                                                <form onSubmit={handleAddByPhone} className="flex gap-2 p-2.5">
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
                                                        {t("member.addBtn")}
                                                    </button>
                                                </form>
                                            )}

                                            {addMemberTab === "email" && (
                                                <div className="p-2.5">
                                                    <div
                                                        className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 mb-2">
                                                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={addQuery}
                                                            onChange={(e) => handleAddQueryChange(e.target.value)}
                                                            placeholder={t("common.emailSearchPlaceholder")}
                                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500"
                                                        />
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                                        {isSearching &&
                                                            <p className="text-center text-slate-500 text-xs py-2">{t("common.searching")}</p>}
                                                        {!isSearching && addQuery.trim() && searchResults.length === 0 && (
                                                            <p className="text-center text-slate-500 text-xs py-2">{t("common.noUserFound")}</p>
                                                        )}
                                                        {searchResults.map((user) => (
                                                            <div key={user.id}
                                                                 className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-700/40">
                                                                <div
                                                                    className="w-7 h-7 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                                    <img
                                                                        src={user.profile || "/avatar.png"}
                                                                        alt={user.name}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => (e.target.src = "/avatar.png")}
                                                                    />
                                                                </div>
                                                                <span
                                                                    className="text-slate-200 text-xs truncate flex-1">{user.name}</span>
                                                                <button
                                                                    onClick={() => handleAddByEmail(user)}
                                                                    disabled={addingId === user.id}
                                                                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded flex-shrink-0"
                                                                >
                                                                    {addingId === user.id ? "..." : t("member.addBtn")}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        {members.map((m) => {
                                            const isOwnerRow = m.user_id === channel.owner;
                                            const isMenuOpen = openMenuMemberId === m.id;

                                            return (
                                                <div key={m.id}
                                                     className="relative flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/40 transition-colors">
                                                    <div
                                                        className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                        <img
                                                            src={m.profile ? resolveUrl(m.profile) : "/avatar.png"}
                                                            alt={m.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => (e.target.src = "/avatar.png")}
                                                        />
                                                    </div>
                                                    <span
                                                        className="text-slate-200 text-sm truncate flex-1">{m.name}</span>
                                                    {m.role === "admin" && (
                                                        <span
                                                            className="flex items-center gap-1 text-violet-400 text-xs flex-shrink-0">
                              <ShieldCheckIcon className="w-3.5 h-3.5"/>
                                                            {t("group.admin")}
                            </span>
                                                    )}

                                                    {!isOwnerRow && (
                                                        <div className="relative flex-shrink-0">
                                                            <button
                                                                onClick={() => setOpenMenuMemberId(isMenuOpen ? null : m.id)}
                                                                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                                            >
                                                                <MoreVertical className="w-4 h-4"/>
                                                            </button>

                                                            {isMenuOpen && (
                                                                <>
                                                                    <div className="fixed inset-0 z-10"
                                                                         onClick={() => setOpenMenuMemberId(null)}/>
                                                                    <div
                                                                        className="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl z-20 w-40 overflow-hidden">
                                                                        {m.role === "admin" ? (
                                                                            <button
                                                                                onClick={() => handleDemote(m)}
                                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 text-right"
                                                                            >
                                                                                <ShieldMinus className="w-3.5 h-3.5"/>
                                                                                {t("channel.demote")}
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handlePromote(m)}
                                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 text-right"
                                                                            >
                                                                                <ShieldCheckIcon
                                                                                    className="w-3.5 h-3.5"/>
                                                                                {t("channel.promote")}
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleRemove(m)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 text-right border-t border-slate-700/50"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5"/>
                                                                            {t("channel.removeFromChannel")}
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <p className="text-center text-slate-500 text-xs py-4">
                                    {t("channel.membersAdminOnly")}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* مودال فوروارد — برای فرستادن لینک دعوت به مخاطب/گروه */}
            <ForwardMessageModal
                isOpen={!!shareAsMessage}
                onClose={() => setShareAsMessage(null)}
                message={shareAsMessage}
            />
        </div>
    );
}

export default ChannelChatContainer;