import {create} from "zustand";
import toast from "react-hot-toast";
import {useAuthStore} from "./useAuthStore";

const API_BASE_URL = "http://localhost:8000";

const safeDate = (value) => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
};

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

let onlineStatusSocket = null;
let onlineStatusReconnectTimer = null;
let onlineStatusConnecting = false;
const messageEventListeners = new Set();

export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    selectedGroup: null,
    socket: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
    pendingEdits: {},
    pendingDeletes: new Set(),
    onlineUsers: [],
    searchResults: [],
    isSearching: false,
    // ✅ NEW: پیام پین‌شده‌ی مکالمه‌ی خصوصی باز — بین دو طرف از طریق سوکت سینک می‌شه
    pinnedMessageId: null,
    // ✅ NEW: وضعیت بلاک مکالمه‌ی فعلاً باز — { iBlockedThem, theyBlockedMe }
    blockStatus: {iBlockedThem: false, theyBlockedMe: false},


    // ---------------- 🌐 اتصال مرکزی وضعیت آنلاین ----------------
    connectOnlineStatusSocket: () => {
        if (
            onlineStatusConnecting ||
            (onlineStatusSocket &&
                (onlineStatusSocket.readyState === WebSocket.OPEN ||
                    onlineStatusSocket.readyState === WebSocket.CONNECTING))
        ) {
            return;
        }

        const token = localStorage.getItem("accessToken");
        if (!token) return;

        onlineStatusConnecting = true;

        const socket = new WebSocket(`ws://localhost:8000/ws/online-status/?token=${token}`);
        onlineStatusSocket = socket;

        socket.onopen = () => {
            onlineStatusConnecting = false;
            socket.send(JSON.stringify({type: "get_contacts"}));
        };

        socket.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            switch (data.type) {
                case "contacts_list": {
                    const onlineIds = data.contacts.filter((c) => c.online).map((c) => String(c.id));
                    get().setOnlineUsers(onlineIds);
                    break;
                }
                case "presence_update": {
                    if (data.online) get().addOnlineUser(String(data.userId));
                    else get().removeOnlineUser(String(data.userId));
                    break;
                }
                // ✅ NEW: طرف مقابل (یا خودت از یه سشن دیگه) پیام‌هایی که فرستادی رو خونده
                case "read_receipt": {
                    const {messageIds = [], readerId} = data;
                    const idSet = new Set(messageIds.map(String));
                    set((state) => ({
                        messages: state.messages.map((m) =>
                            idSet.has(String(m._id)) || idSet.has(String(m.id))
                                ? {...m, isRead: true}
                                : m
                        ),
                    }));
                    break;
                }
                case "new_message_notify":
                case "message_edit_notify":
                case "message_delete_notify": {
                    messageEventListeners.forEach((cb) => {
                        try {
                            cb(data);
                        } catch (err) {
                            console.error("message listener error:", err);
                        }
                    });
                    break;
                }
                default:
                    break;
            }
        };

        socket.onerror = (err) => {
            console.error("❌ Online-status WS error", err);
        };

        socket.onclose = (event) => {
            onlineStatusConnecting = false;
            onlineStatusSocket = null;

            const token = localStorage.getItem("accessToken");
            if (token) {
                clearTimeout(onlineStatusReconnectTimer);
                onlineStatusReconnectTimer = setTimeout(() => {
                    get().connectOnlineStatusSocket();
                }, 3000);
            }
        };
    },

    disconnectOnlineStatusSocket: () => {
        clearTimeout(onlineStatusReconnectTimer);
        onlineStatusReconnectTimer = null;
        onlineStatusConnecting = false;
        if (onlineStatusSocket) {
            onlineStatusSocket.onclose = null;
            onlineStatusSocket.close();
            onlineStatusSocket = null;
        }
    },

    addMessageEventListener: (cb) => {
        messageEventListeners.add(cb);
        return () => messageEventListeners.delete(cb);
    },

    // ---------------- ⚡️ Online Users ----------------
    setOnlineUsers: (list) => {
        if (!Array.isArray(list)) return;
        set({onlineUsers: list});
    },

    addOnlineUser: (userId) =>
        set((state) => {
            if (!state.onlineUsers.includes(userId)) {
                return {onlineUsers: [...state.onlineUsers, userId]};
            }
            return {};
        }),

    removeOnlineUser: (userId) =>
        set((state) => ({
            onlineUsers: state.onlineUsers.filter((id) => id !== userId),
        })),

    // ---------------- ⚙️ UI Settings ----------------
    setActiveTab: (tab) => set({activeTab: tab}),

    // ---------------- 🔊 Sound Toggle ----------------
    toggleSound: () => {
        set((state) => {
            const next = !state.isSoundEnabled;
            localStorage.setItem("isSoundEnabled", JSON.stringify(next));
            return {isSoundEnabled: next};
        });
    },

    // ---------------- 👤 Selected User ----------------
    setSelectedUser: (user) => {
        const {authUser} = useAuthStore.getState();
        if (!authUser?.id) return toast.error("Auth user not loaded yet");

        get().unsubscribeFromMessages();

        if (!user) {
            set({selectedUser: null, messages: [], blockStatus: {iBlockedThem: false, theyBlockedMe: false}});
            return;
        }

        const userId = user._id || user.raw?.user || user.email;

        user._id = userId;
        user.name = user.name || `Contact ${user.raw?.contact || user._id}`;
        user.email = user.email || null;

        set({
            selectedUser: user,
            selectedGroup: null,
            messages: [],
            pinnedMessageId: null,
            blockStatus: {iBlockedThem: false, theyBlockedMe: false},
        });

        get().getMessagesByUserId();
        get().subscribeToMessages(userId);
        // ✅ NEW: وضعیت بلاک این مکالمه رو می‌گیریم
        get().fetchBlockStatus(userId);
    },

    setSelectedGroup: (group) => {
        get().unsubscribeFromMessages();
        set({selectedGroup: group, selectedUser: null, messages: []});
    },

    clearSelection: () => {
        get().unsubscribeFromMessages();
        set({selectedUser: null, selectedGroup: null, messages: []});
    },

    // ---------------- 🚫 Block / Report (✅ NEW) ----------------
    fetchBlockStatus: async (userId) => {
        const token = localStorage.getItem("accessToken");
        if (!token || !userId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/chat/blocks/status/${userId}/`, {
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) return;
            const data = await res.json();
            set({
                blockStatus: {
                    iBlockedThem: !!data.i_blocked_them,
                    theyBlockedMe: !!data.they_blocked_me,
                },
            });
        } catch {
            // وضعیت بلاک بحرانی نیست؛ اگه نگرفتیم پیش‌فرض (بلاک‌نشده) رو نگه می‌داریم
        }
    },

    blockUser: async (userId) => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            toast.error("No access token found");
            return false;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/chat/blocks/`, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
                body: JSON.stringify({blocked_user: userId}),
            });
            if (!res.ok) throw new Error();
            set((state) => ({blockStatus: {...state.blockStatus, iBlockedThem: true}}));
            toast.success("کاربر مسدود شد");
            return true;
        } catch {
            toast.error("خطا در مسدود کردن کاربر");
            return false;
        }
    },

    unblockUser: async (userId) => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            toast.error("No access token found");
            return false;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/chat/blocks/unblock/${userId}/`, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) throw new Error();
            set((state) => ({blockStatus: {...state.blockStatus, iBlockedThem: false}}));
            toast.success("مسدودیت برداشته شد");
            return true;
        } catch {
            toast.error("خطا در رفع مسدودیت");
            return false;
        }
    },

    reportUser: async (userId, reason, description) => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            toast.error("No access token found");
            return false;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/chat/report/`, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
                body: JSON.stringify({reported_user: userId, reason, description}),
            });
            if (!res.ok) throw new Error();
            toast.success("گزارش ثبت شد");
            return true;
        } catch {
            toast.error("خطا در ثبت گزارش");
            return false;
        }
    },

    // ---------------- 📇 Contacts & Chats ----------------
    getAllContacts: async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        set({isUsersLoading: true});
        try {
            const res = await fetch(`${API_BASE_URL}/chat/contacts/`, {
                headers: {Authorization: `Bearer ${token}`},
            });
            const data = await res.json();
            set({
                allContacts: data.map((c) => ({
                    _id: c.contact,
                    email: c.contact_email || null,
                    phoneNumber: c.phone_number || null,
                    name: c.name || c.display_name || c.phone_number || c.contact_email,
                    profile: c.profile || null,
                    raw: c,
                })),
            });
        } catch {
            toast.error("Failed to fetch contacts");
        } finally {
            set({isUsersLoading: false});
        }
    },

    chatList: [],
    isChatListLoading: false,

    // ✅ NEW: لیست واقعی مکالمات (نه فقط مخاطبین رسمی)
    getChatList: async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        set({isChatListLoading: true});
        try {
            const res = await fetch(`${API_BASE_URL}/chat/conversations/`, {
                headers: {Authorization: `Bearer ${token}`},
            });
            const data = await res.json();
            set({
                chatList: (Array.isArray(data) ? data : []).map((c) => ({
                    _id: c.id,
                    id: c.id,
                    email: c.email || null,
                    phoneNumber: c.phone_number || null,
                    name: c.name,
                    profile: c.profile || null,
                    is_contact: c.is_contact,
                    raw: {id: c.contact_record_id, profile: c.profile},
                    last_message: c.last_message,
                })),
            });
        } catch {
            toast.error("خطا در دریافت مکالمات");
        } finally {
            set({isChatListLoading: false});
        }
    },


    // ---------------- 🔍 Search (فعلاً بلااستفاده، برای آینده نگه داشته شده) ----------------
    searchUsers: async (query) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        if (!query.trim()) {
            set({searchResults: []});
            return;
        }
        set({isSearching: true});
        try {
            const res = await fetch(`${API_BASE_URL}/chat/search-users/?q=${encodeURIComponent(query)}`, {
                headers: {Authorization: `Bearer ${token}`},
            });
            const data = await res.json();
            set({searchResults: data});
        } catch {
            toast.error("خطا در جستجوی کاربران");
        } finally {
            set({isSearching: false});
        }
    },

    clearSearch: () => set({searchResults: []}),

    // ✅ حالا با شماره + اسم دلخواه کار می‌کنه (مثل واتساب)
    // ✅ حالا با شماره یا با user_id (از جستجوی ایمیل) کار می‌کنه
    addContact: async ({phoneNumber, userId, displayName}) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        try {
            const body = {display_name: displayName};
            if (phoneNumber) body.phone_number = phoneNumber;
            if (userId) body.user_id = userId;

            const res = await fetch(`${API_BASE_URL}/chat/contacts/`, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json();
                const msg =
                    err.phone_number?.[0] ||
                    err.email?.[0] ||
                    err.display_name?.[0] ||
                    err.detail ||
                    "خطا در افزودن مخاطب";
                toast.error(msg);
                return false;
            }

            toast.success("مخاطب با موفقیت اضافه شد");
            get().getAllContacts();
            return true;
        } catch {
            toast.error("خطا در افزودن مخاطب");
            return false;
        }
    },

    deleteContact: async (contactRecordId) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        try {
            const res = await fetch(`${API_BASE_URL}/chat/contacts/${contactRecordId}/`, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });

            if (!res.ok) {
                toast.error("خطا در حذف مخاطب");
                return false;
            }

            set((state) => ({
                allContacts: state.allContacts.filter((c) => c.raw?.id !== contactRecordId),
            }));
            toast.success("مخاطب حذف شد");
            return true;
        } catch {
            toast.error("خطا در حذف مخاطب");
            return false;
        }
    },

    // ✅ NEW: پاک کردن یه چت از لیست (فقط برای کاربر جاری) — مخاطب و پیام‌ها دست‌نخورده می‌مونن.
    // اگه بعداً پیام جدیدی رد و بدل بشه، این چت خودش دوباره تو لیست ظاهر می‌شه.
    deleteConversation: async (partnerId) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        try {
            const res = await fetch(`${API_BASE_URL}/chat/conversations/${partnerId}/`, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });

            if (!res.ok) {
                toast.error("خطا در پاک کردن چت");
                return false;
            }

            set((state) => ({
                chatList: state.chatList.filter((c) => String(c.id) !== String(partnerId)),
            }));
            toast.success("چت پاک شد");
            return true;
        } catch {
            toast.error("خطا در پاک کردن چت");
            return false;
        }
    },

    // ---------------- 💬 Messages ----------------
    getMessagesByUserId: async () => {
        const {selectedUser} = get();
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        if (!selectedUser?._id) return toast.error("No selected user");

        set({isMessagesLoading: true});
        try {
            const res = await fetch(`${API_BASE_URL}/chat/messages/${selectedUser._id}/`, {
                headers: {Authorization: `Bearer ${token}`},
            });
            const data = await res.json();
            const messagesWithDate = data.map((msg) => ({
                ...msg,
                _id: msg._id || msg.id,
                senderId: msg.sender || msg.senderId,
                receiverId: msg.receiver || msg.receiverId,
                text: msg.text || "",
                image: msg.image || null,
                file: msg.file || null,
                fileName: msg.file_name || msg.fileName || null,
                messageType: msg.message_type || msg.messageType || "text",
                meta: msg.meta || null,
                // ✅ NEW: وضعیت خوانده‌شدن پیام (برای تیک آبی)
                isRead: msg.is_read ?? msg.isRead ?? false,
                // ✅ NEW: اگه بک‌اند این فیلد رو برگردونه، پیش‌نمایش ریپلای بعد از رفرش هم می‌مونه
                replyTo: msg.replyTo || msg.reply_to || null,
                createdAt: safeDate(msg.created_date || msg.createdAt),
                isOptimistic: false,
            }));
            const sortedMessages = [...messagesWithDate].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
            );
            set({messages: sortedMessages});
        } catch {
            toast.error("Failed to fetch messages");
        } finally {
            set({isMessagesLoading: false});
        }
    },

    // ✅ sendMessage حالا یه payload کامل قبول می‌کنه:
    // { text, image (File|base64|null), file (File|base64|null), fileName, messageType, meta, replyTo }
    sendMessage: async (payload = {}) => {
        const {selectedUser, messages, socket, blockStatus} = get();
        const {authUser} = useAuthStore.getState();
        if (!selectedUser || !authUser?.id) return toast.error("No selected user or auth user");

        // ✅ NEW: قبل از هر چیز چک بلاک (سمت کلاینت — سرور هم دوباره چک می‌کنه)
        if (blockStatus.iBlockedThem || blockStatus.theyBlockedMe) {
            toast.error(
                blockStatus.iBlockedThem
                    ? "این کاربر را مسدود کرده‌اید — برای ارسال پیام مسدودیت را بردارید"
                    : "امکان ارسال پیام به این کاربر وجود ندارد"
            );
            return;
        }

        const senderId = authUser.id;
        const receiverId = selectedUser._id;
        const tempId = `temp-${Date.now()}`;

        const {
            text = "",
            image = null,
            file = null,
            fileName = null,
            messageType = "text",
            meta = null,
            // ✅ NEW: { id, text, senderName } — از منوی «ریپلای» پیام می‌آد
            replyTo = null,
        } = payload;

        let imageData = null;
        if (image instanceof File) {
            imageData = await fileToBase64(image);
        } else if (typeof image === "string") {
            imageData = image;
        }

        let fileData = null;
        let resolvedFileName = fileName;
        if (file instanceof File) {
            fileData = await fileToBase64(file);
            resolvedFileName = fileName || file.name;
        } else if (typeof file === "string") {
            fileData = file;
        }

        const optimisticMessage = {
            _id: tempId,
            senderId,
            receiverId,
            text,
            image: imageData,
            file: fileData,
            fileName: resolvedFileName,
            messageType,
            meta,
            replyTo,
            isRead: false,
            createdAt: safeDate(),
            isOptimistic: true,
        };

        set({messages: [...messages, optimisticMessage]});

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message: {
                        text,
                        senderId,
                        receiverId,
                        tempId,
                        image: imageData,
                        file: fileData,
                        fileName: resolvedFileName,
                        messageType,
                        meta,
                        replyTo,
                    },
                })
            );
        }
    },

    // ✅ NEW: علامت‌گذاری پیام‌های دریافتی به‌عنوان خوانده‌شده (تیک آبی طرف مقابل)
    markMessagesRead: (messageIds) => {
        const {socket} = get();
        const realIds = (messageIds || []).filter((id) => typeof id !== "string" || !id.startsWith("temp-"));
        if (!realIds.length || !socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({type: "mark_read", messageIds: realIds}));
    },

    // ---------------- 🧠 WebSocket چت (فقط برای مکالمه‌ی باز) ----------------
    subscribeToMessages: (roomName) => {
        if (!roomName) return;
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${roomName}/?token=${token}`);

        ws.onopen = () => console.log("🟢 WebSocket connected:", roomName);
        ws.onclose = () => console.log("🔴 WebSocket closed:", roomName);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data) return;

                if (data.type === "connection") return;

                // ✅ NEW: خطاهایی مثل «بلاک هستید» از سرور اینجا نمایش داده می‌شن
                if (data.type === "error") {
                    if (data.error) toast.error(data.error);
                    return;
                }

                if (data.type === "edit_message") {
                    const {messageId, newText} = data;
                    set((state) => ({
                        messages: state.messages.map((m) =>
                            m._id === messageId ? {...m, text: newText, edited: true} : m
                        ),
                    }));
                    return;
                }

                if (data.type === "delete_message") {
                    const {messageId} = data;
                    set((state) => ({
                        messages: state.messages.filter((m) => m._id !== messageId),
                    }));
                    return;
                }

                // ✅ NEW: پین/آن‌پین که طرف مقابل (یا خودت از تب دیگه) انجام داده
                if (data.type === "pin_message") {
                    set({pinnedMessageId: data.pinned ? data.messageId : null});
                    return;
                }

                // ✅ NEW: آپدیت لحظه‌ای نتیجه‌ی رأی‌گیری
                if (data.type === "poll_update") {
                    const {messageId, meta} = data;
                    set((state) => ({
                        messages: state.messages.map((m) =>
                            m._id === messageId ? {...m, meta} : m
                        ),
                    }));
                    return;
                }

                if (data.message) {
                    const msg = data.message;
                    set((state) => {
                        const exists = state.messages.find((m) => m._id === msg.tempId);
                        const newMessage = {
                            ...msg,
                            _id: msg.id || msg._id || msg.tempId,
                            messageType: msg.messageType || msg.message_type || "text",
                            fileName: msg.fileName || msg.file_name || null,
                            // ✅ NEW: وضعیت خوانده‌شدن (تازه ساخته شده، پس معمولاً false هست)
                            isRead: msg.isRead ?? msg.is_read ?? false,
                            // ✅ NEW: اگه بک‌اند همون replyTo که فرستادیم رو برگردونه، اینجا حفظ می‌شه
                            // ✅ FIX: اگه بک‌اند replyTo رو echo نکنه، از نسخه‌ی optimistic محلی
                            // (که قبلاً همین پیام رو با replyTo داشتیم) استفاده کن تا حداقل
                            // برای خودِ فرستنده پاک نشه
                            replyTo: msg.replyTo || msg.reply_to || exists?.replyTo || null,
                            createdAt: safeDate(msg.createdAt || msg.created_date),
                            isOptimistic: false,
                        };

                        if (exists) {
                            let updatedMessages = state.messages.map((m) =>
                                m._id === exists._id ? newMessage : m
                            );

                            const realId = msg.id || msg._id;

                            if (state.pendingEdits[exists._id]) {
                                const newText = state.pendingEdits[exists._id];
                                if (state.socket?.readyState === WebSocket.OPEN) {
                                    state.socket.send(
                                        JSON.stringify({type: "edit_message", messageId: realId, newText})
                                    );
                                }
                                delete state.pendingEdits[exists._id];
                            }

                            if (state.pendingDeletes.has(exists._id)) {
                                if (state.socket?.readyState === WebSocket.OPEN) {
                                    state.socket.send(
                                        JSON.stringify({type: "delete_message", messageId: realId})
                                    );
                                }
                                state.pendingDeletes.delete(exists._id);
                            }

                            return {messages: updatedMessages};
                        }

                        const alreadyThere = state.messages.some((m) => m._id === newMessage._id);
                        if (alreadyThere) return {};

                        return {messages: [...state.messages, newMessage]};
                    });
                }
            } catch (err) {
                console.error("❌ Error parsing WS message:", err);
            }
        };

        set({socket: ws});
    },

    unsubscribeFromMessages: () => {
        const socket = get().socket;
        if (socket) {
            socket.onclose = null;
            socket.close();
            set({socket: null});
        }
    },

    // ✅ NEW: پین/آن‌پین — هم محلی آپدیت می‌کنه (سریع)، هم به سرور می‌فرسته
    // تا طرف مقابل هم همون لحظه ببینه (فقط real-time، تو رفرش پاک می‌شه)
    togglePinMessage: (messageId) => {
        const {socket, pinnedMessageId} = get();
        const willBePinned = pinnedMessageId !== messageId;
        set({pinnedMessageId: willBePinned ? messageId : null});

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({type: "pin_message", messageId, pinned: willBePinned}));
        }
    },

    // ✅ NEW: رأی دادن به نظرسنجی (چت خصوصی)
    votePoll: (messageId, optionId) => {
        const {socket} = get();
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({type: "vote_poll", messageId, optionId}));
    },

    editMessage: (messageId, newText) => {
        const {messages, socket, pendingEdits} = get();
        const msg = messages.find((m) => m._id === messageId);
        if (!msg) return toast.error("Message not found");

        set({
            messages: messages.map((m) => (m._id === messageId ? {...m, text: newText, edited: true} : m)),
        });

        if (String(messageId).startsWith("temp-")) {
            pendingEdits[messageId] = newText;
            return;
        }

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({type: "edit_message", messageId, newText}));
        }
    },

    deleteMessage: (messageId) => {
        const {messages, socket, pendingDeletes} = get();
        const msg = messages.find((m) => m._id === messageId);
        if (!msg) return;

        set({messages: messages.filter((m) => m._id !== messageId)});

        if (String(messageId).startsWith("temp-")) {
            pendingDeletes.add(messageId);
            return;
        }

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({type: "delete_message", messageId}));
        }
    },

    logout: () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("isSoundEnabled");

        const socket = get().socket;
        if (socket) socket.close();

        get().disconnectOnlineStatusSocket();

        set({
            allContacts: [],
            chats: [],
            messages: [],
            selectedUser: null,
            socket: null,
            onlineUsers: [],
            searchResults: [],
            blockStatus: {iBlockedThem: false, theyBlockedMe: false},
        });
    },
}));