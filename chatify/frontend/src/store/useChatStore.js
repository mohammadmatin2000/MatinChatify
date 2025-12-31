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

export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    selectedGroup: null, // ✅ اضافه شد
    socket: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
    pendingEdits: {},
    pendingDeletes: new Set(),
    onlineUsers: [],

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


    // ✅ اصلاح: لاگ اضافه شد تا مقدار activeTab بررسی شود
    setActiveTab: (tab) => {
        console.log("Setting activeTab:", tab);
        set({activeTab: tab});
    },

    // ---------------- 👤 Selected User ----------------
    setSelectedUser: (user) => {
        const {authUser} = useAuthStore.getState();
        if (!authUser?.id) return toast.error("Auth user not loaded yet");

        // ⚠️ قبل از ساخت WebSocket جدید، WS قبلی را ببند
        get().unsubscribeFromMessages();

        if (!user) {
            set({selectedUser: null, messages: []});
            return;
        }

        const userId = user._id || user.raw?.user || user.email;
        const roomName = [authUser.id, userId].sort().join("_");

        user._id = userId;
        user.name = user.name || `Contact ${user.raw?.contact || user._id}`;
        user.email = user.email || null;

        set({
            selectedUser: user,
            selectedGroup: null, // ✅ گروه پاک می‌شود
            messages: [],
        });

        get().getMessagesByUserId();
        get().subscribeToMessages(roomName);

    },
    setSelectedGroup: (group) => {
        // ❗ WS خصوصی را ببند
        get().unsubscribeFromMessages();

        set({
            selectedGroup: group,
            selectedUser: null, // ✅ یوزر پاک می‌شود
            messages: [], // پیام گروه داخل GroupChatContainer مدیریت می‌شود
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
                    raw: c,
                })),
            });
        } catch {
            toast.error("Failed to fetch contacts");
        } finally {
            set({isUsersLoading: false});
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

    // ---------------- 🧠 WebSocket ----------------
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

                if (data.type === "update_online_users") {
                    get().setOnlineUsers(data.onlineUsers);
                    return;
                }

                if (data.type === "user_status") {
                    if (data.isOnline) get().addOnlineUser(data.userId);
                    else get().removeOnlineUser(data.userId);
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
        set({
            allContacts: [],
            chats: [],
            messages: [],
            selectedUser: null,
            socket: null,
            onlineUsers: [],
        });
    },
}));
