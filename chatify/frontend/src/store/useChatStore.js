import {create} from "zustand";
import toast from "react-hot-toast";
import {useAuthStore} from "./useAuthStore";

const API_BASE_URL = "http://localhost:8000";

// ✅ تابع امن برای تاریخ‌ها
const safeDate = (value) => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
};

// ======================================================================================================================
// ✅ اتصال WebSocket سراسری وضعیت آنلاین — فقط یک نمونه برای کل اپ
// (عمداً بیرون از zustand state نگه داشته می‌شه چون خود instance نیازی نیست reactive باشه)
// ======================================================================================================================
let onlineStatusSocket = null;
let onlineStatusReconnectTimer = null;
let onlineStatusConnecting = false;
const messageEventListeners = new Set(); // برای new_message_notify / edit / delete

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

    // ---------------- 🌐 اتصال مرکزی وضعیت آنلاین ----------------
    connectOnlineStatusSocket: () => {
        // اگه از قبل وصله یا در حال وصل شدنه، دوباره وصل نشو
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
            console.log("🟢 Online-status WS connected (central)");
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
                    if (data.online) {
                        get().addOnlineUser(String(data.userId));
                    } else {
                        get().removeOnlineUser(String(data.userId));
                    }
                    break;
                }

                case "new_message_notify":
                case "message_edit_notify":
                case "message_delete_notify": {
                    // این‌ها رو به هرکسی که subscribe کرده (مثلاً ChatsList) پاس بده
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
            console.log("🔴 Online-status WS closed (central)", event.code);
            onlineStatusSocket = null;

            // فقط اگه هنوز توکن داریم (یعنی لاگ‌اوت نکردیم) دوباره وصل شو
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
            onlineStatusSocket.onclose = null; // جلوگیری از reconnect خودکار موقع logout
            onlineStatusSocket.close();
            onlineStatusSocket = null;
        }
    },

    // ✅ برای کامپوننت‌هایی مثل ChatsList که نیاز به رویدادهای پیام دارن (بدون ساختن socket جدا)
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
    setActiveTab: (tab) => {
        set({activeTab: tab});
    },

    // ---------------- 👤 Selected User ----------------
    setSelectedUser: (user) => {
        const {authUser} = useAuthStore.getState();
        if (!authUser?.id) return toast.error("Auth user not loaded yet");

        get().unsubscribeFromMessages();

        if (!user) {
            set({selectedUser: null, messages: []});
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
        });

        get().getMessagesByUserId();

        // ✅ فقط آیدی خام طرف مقابل رو می‌فرستیم — بک‌اند خودش با sorted([my_id, userId])
        // نام روم یکتا و ثابت می‌سازه. ترکیب کردنش اینجا باعث دابل‌ترکیب و روم اشتباه می‌شد.
        get().subscribeToMessages(userId);
    },

    setSelectedGroup: (group) => {
        get().unsubscribeFromMessages();
        set({
            selectedGroup: group,
            selectedUser: null,
            messages: [],
        });
    },

    clearSelection: () => {
        get().unsubscribeFromMessages();
        set({
            selectedUser: null,
            selectedGroup: null,
            messages: [],
        });
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
                    _id: c.contact || c.user,
                    email: c.contact_email || null,
                    name: c.name || c.contact_email || `Contact ${c.contact || c.user}`,
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

    // ---------------- 🔍 Search & Add Contact ----------------
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

    addContact: async (contactId) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return toast.error("No access token found");
        try {
            const res = await fetch(`${API_BASE_URL}/chat/contacts/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({contact: contactId}),
            });

            if (!res.ok) {
                const err = await res.json();
                const msg = err.contact?.[0] || "خطا در افزودن مخاطب";
                toast.error(msg);
                return false;
            }

            toast.success("مخاطب با موفقیت اضافه شد");

            set((state) => ({
                searchResults: state.searchResults.map((u) =>
                    u.id === contactId ? {...u, is_contact: true} : u
                ),
            }));

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
                createdAt: safeDate(msg.created_date || msg.createdAt),
                isOptimistic: false,
            }));
            set({messages: messagesWithDate});
        } catch {
            toast.error("Failed to fetch messages");
        } finally {
            set({isMessagesLoading: false});
        }
    },

    sendMessage: async ({text, image}) => {
        const {selectedUser, messages, socket} = get();
        const {authUser} = useAuthStore.getState();
        if (!selectedUser || !authUser?.id) return toast.error("No selected user or auth user");

        const senderId = authUser.id;
        const receiverId = selectedUser._id;
        const tempId = `temp-${Date.now()}`;

        let imageData = null;
        if (image instanceof File) {
            imageData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(image);
            });
        } else {
            imageData = image || null;
        }

        const optimisticMessage = {
            _id: tempId,
            senderId,
            receiverId,
            text,
            image: imageData,
            createdAt: safeDate(),
            isOptimistic: true,
        };

        set({messages: [...messages, optimisticMessage]});

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message: {text, senderId, receiverId, tempId, image: imageData},
                })
            );
        }
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

                // ✅ پیام تاییدیه‌ی اتصال (نه یه پیام واقعی) — نباید وارد لیست messages بشه
                // چون _id/tempId نداره و باعث key تکراری/undefined توی React می‌شه
                if (data.type === "connection") {
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

                if (data.message) {
                    const msg = data.message;
                    set((state) => {
                        const exists = state.messages.find((m) => m._id === msg.tempId);
                        const newMessage = {
                            ...msg,
                            _id: msg.id || msg._id || msg.tempId,
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

                        // ✅ جلوگیری از تکرار پیام (اگه به هر دلیلی همون _id از قبل توی لیست بود)
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

    editMessage: (messageId, newText) => {
        const {messages, socket, pendingEdits} = get();
        const msg = messages.find((m) => m._id === messageId);
        if (!msg) return toast.error("Message not found");

        set({
            messages: messages.map((m) =>
                m._id === messageId ? {...m, text: newText, edited: true} : m
            ),
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
        });
    },
}));