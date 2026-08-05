import { create } from "zustand";
import axios from "axios";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALL_WS_URL = "ws://localhost:8000/ws/call/";
const CALL_API_BASE = "http://localhost:8000/call";

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

async function acquireStream(get, constraints) {
  stopStream(get().localStream);
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    console.error("❌ getUserMedia error:", err.name, err.message);
    throw err;
  }
}

// ✅ FIX: سوکت تماس به یه متغیر ماژول‌سطح منتقل شد (به‌جای state زوستند) با
// منطق reconnect خودکار — دقیقاً مثل الگوی onlineStatusSocket توی
// useChatStore. قبلاً اگه سوکت قطع می‌شد (network hiccup و غیره)، هیچ
// تلاشی برای وصل‌شدن دوباره نبود و کاربر تا رفرش صفحه دیگه هیچ تماسی
// دریافت نمی‌کرد.
let callSocket = null;
let callReconnectTimer = null;
let callConnecting = false;

export const useCallStore = create((set, get) => ({
  // ---- وضعیت کلی تماس دو نفره ----
  callStatus: "idle", // idle | calling | ringing | connected
  callType: null, // "audio" | "video"
  remoteUser: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,
  callError: null,

  isCaller: false,
  callConnectedAt: null,

  // ✅ NEW: قبلاً "کوچک‌شدن" تماس یه state محلی داخل خودِ CallModal/
  // GroupCallModal بود، برای همین هیچ صفحه‌ی دیگه‌ای (مثل ChatPage) راهی
  // نداشت بهش بگه "الان وقتشه کوچیک بشی". حالا این state مشترکه.
  isMinimized: false,

  // ---- وضعیت تماس گروهی (mesh) ----
  groupCallStatus: "idle", // idle | in-call
  groupCallType: null,
  activeGroupId: null,
  activeGroupName: null,
  groupParticipants: {},
  groupCallInvite: null,

  // ---- اتصالات داخلی ----
  peerConnection: null,
  incomingOffer: null,
  // ✅ FIX: صف ICE candidate های تماس ۱به۱ که قبل از setRemoteDescription
  // می‌رسن — قبلاً این‌ها بی‌صدا (catch خالی) گم می‌شدن.
  pendingCandidates: [],
  // ✅ FIX: همون صف ولی برای هر شرکت‌کننده‌ی تماس گروهی جدا (کلید = fromId)
  pendingGroupCandidates: {},

  // ========================== اتصال به سرور سیگنالینگ ==========================
  connectCallSocket: () => {
    if (
      callConnecting ||
      (callSocket && (callSocket.readyState === WebSocket.OPEN || callSocket.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    callConnecting = true;
    const socket = new WebSocket(`${CALL_WS_URL}?token=${token}`);
    callSocket = socket;

    socket.onopen = () => {
      callConnecting = false;
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      get().handleSignal(data);
    };

    socket.onerror = (err) => {
      console.error("❌ Call signaling WS error", err);
    };

    socket.onclose = () => {
      callConnecting = false;
      callSocket = null;
      const token = localStorage.getItem("accessToken");
      if (token) {
        clearTimeout(callReconnectTimer);
        callReconnectTimer = setTimeout(() => {
          get().connectCallSocket();
        }, 3000);
      }
    };
  },

  // ✅ FIX: قبلاً وجود نداشت — لازمه موقع logout صدا زده بشه.
  disconnectCallSocket: () => {
    clearTimeout(callReconnectTimer);
    callReconnectTimer = null;
    callConnecting = false;
    if (callSocket) {
      callSocket.onclose = null;
      callSocket.close();
      callSocket = null;
    }
  },

  // ========================== شروع تماس دو نفره (طرف تماس‌گیرنده) ==========================
  startCall: async (targetUser, type) => {
    if (get().callStatus !== "idle") {
      console.warn("⚠️ Already in a call, ignoring startCall");
      return;
    }

    get().connectCallSocket();

    set({
      callStatus: "calling",
      callType: type,
      remoteUser: targetUser,
      callError: null,
      isCaller: true,
      callConnectedAt: null,
      pendingCandidates: [],
      isMinimized: false,
    });

    let stream;
    try {
      stream = await acquireStream(get, { audio: true, video: type === "video" });
    } catch (err) {
      set({
        callStatus: "idle",
        callType: null,
        remoteUser: null,
        callError: describeMediaError(err),
        isCaller: false,
      });
      return;
    }

    set({ localStream: stream });

    const pc = createPeerConnection(get, targetUser.id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    set({ peerConnection: pc });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // ✅ FIX: قبلاً از targetUser.myName/myImage خونده می‌شد که وجود نداره
    // (targetUser طرف مقابله، نه خودمون). حالا از useAuthStore اطلاعات
    // واقعی خودمون رو می‌فرستیم — دقیقاً مثل startGroupCall که همین‌جا
    // درست انجامش داده.
    const { useAuthStore } = await import("./useAuthStore");
    const { authUser } = useAuthStore.getState();

    sendSignal({
      type: "call_offer",
      targetId: targetUser.id,
      callType: type,
      sdp: offer,
      callerInfo: { name: authUser?.name || authUser?.email, image: authUser?.image },
    });
  },

  // ========================== دریافت پیام سیگنالینگ ==========================
  handleSignal: (data) => {
    if (data.groupId || data.targetGroupId || data.type?.startsWith("group_call_") || data.type === "adhoc_upgrade") {
      get().handleGroupSignal(data);
      return;
    }

    switch (data.type) {
      case "call_offer":
        if (get().callStatus !== "idle") {
          sendSignal({ type: "call_reject", targetId: data.fromId });
          return;
        }
        set({
          callStatus: "ringing",
          callType: data.callType,
          incomingOffer: data,
          remoteUser: { id: data.fromId, name: data.callerInfo?.name, image: data.callerInfo?.image },
          isCaller: false,
          callConnectedAt: null,
          pendingCandidates: [],
          isMinimized: false,
        });
        break;

      case "call_answer":
        get()
          .peerConnection?.setRemoteDescription(new RTCSessionDescription(data.sdp))
          .then(() => get().flushPendingCandidates());
        set({ callStatus: "connected", callConnectedAt: Date.now() });
        break;

      case "ice_candidate": {
        // ✅ FIX: صف‌بندی به‌جای شکست بی‌صدا وقتی remote description هنوز ست نشده
        const pc = get().peerConnection;
        const candidate = new RTCIceCandidate(data.candidate);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          pc.addIceCandidate(candidate).catch((err) => console.error("ICE add error:", err));
        } else {
          set((state) => ({ pendingCandidates: [...state.pendingCandidates, candidate] }));
        }
        break;
      }

      case "call_end":
        get().endCall(false);
        break;

      case "call_reject": {
        const { isCaller, remoteUser, callType } = get();
        if (isCaller && remoteUser) {
          logCallToServer({
            receiverId: remoteUser.id,
            callType,
            status: "rejected",
            duration: 0,
          });
        }
        set({ callStatus: "idle", remoteUser: null, isCaller: false, callConnectedAt: null });
        break;
      }

      default:
        break;
    }
  },

  // ✅ کمکی: صف candidate های ۱به۱ رو بعد از ست‌شدن remote description خالی می‌کنه
  flushPendingCandidates: () => {
    const { peerConnection, pendingCandidates } = get();
    if (!peerConnection || pendingCandidates.length === 0) return;
    pendingCandidates.forEach((c) => peerConnection.addIceCandidate(c).catch((err) => console.error("ICE add error:", err)));
    set({ pendingCandidates: [] });
  },

  // ========================== قبول کردن تماس دو نفره ورودی ==========================
  acceptCall: async () => {
    const { incomingOffer, remoteUser, callStatus } = get();
    if (!incomingOffer || callStatus !== "ringing") return;

    let stream;
    try {
      stream = await acquireStream(get, { audio: true, video: incomingOffer.callType === "video" });
    } catch (err) {
      get().rejectCall();
      set({ callError: describeMediaError(err) });
      return;
    }

    set({ localStream: stream });

    const pc = createPeerConnection(get, remoteUser.id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    set({ peerConnection: pc });

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.sdp));
    get().flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendSignal({
      type: "call_answer",
      targetId: remoteUser.id,
      sdp: answer,
    });

    set({ callStatus: "connected", callConnectedAt: Date.now() });
  },

  // ========================== رد کردن تماس دو نفره ورودی ==========================
  rejectCall: () => {
    const { remoteUser } = get();
    if (remoteUser) {
      sendSignal({ type: "call_reject", targetId: remoteUser.id });
    }
    set({ callStatus: "idle", remoteUser: null, incomingOffer: null, isCaller: false, callConnectedAt: null, pendingCandidates: [], isMinimized: false });
  },

  // ========================== پایان دادن به تماس دو نفره ==========================
  endCall: (notifyOther = true) => {
    const { peerConnection, localStream, remoteUser, callStatus, isCaller, callConnectedAt, callType } = get();

    if (notifyOther && remoteUser) {
      sendSignal({ type: "call_end", targetId: remoteUser.id });
    }

    if (isCaller && remoteUser) {
      const wasConnected = callStatus === "connected" && callConnectedAt;
      const duration = wasConnected ? Math.round((Date.now() - callConnectedAt) / 1000) : 0;
      logCallToServer({
        receiverId: remoteUser.id,
        callType,
        status: wasConnected ? "answered" : "missed",
        duration,
      });
    }

    peerConnection?.close();
    stopStream(localStream);

    set({
      callStatus: "idle",
      callType: null,
      remoteUser: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      incomingOffer: null,
      isMicMuted: false,
      isCameraOff: false,
      isCaller: false,
      callConnectedAt: null,
      pendingCandidates: [],
      isMinimized: false,
    });
  },

  clearCallError: () => set({ callError: null }),

  // ========================== افزودن یه عضو به تماس فعلی (خصوصی یا گروهی) ==========================
  addParticipant: (targetUser, myInfo) => {
    const state = get();
    const inPrivateCall = state.callStatus === "connected" || state.callStatus === "calling";
    const inGroupCall = state.groupCallStatus === "in-call";

    if (!inPrivateCall && !inGroupCall) return;

    if (inPrivateCall && !inGroupCall) {
      const { peerConnection, remoteUser, remoteStream, callType } = state;
      if (!remoteUser) return;

      const adhocId = `adhoc_${remoteUser.id}_${Date.now()}`;

      set({
        groupCallStatus: "in-call",
        groupCallType: callType,
        activeGroupId: adhocId,
        activeGroupName: "تماس چندنفره",
        groupParticipants: {
          [remoteUser.id]: { name: remoteUser.name, image: remoteUser.image, pc: peerConnection, stream: remoteStream },
        },
        callStatus: "idle",
        callType: null,
        remoteUser: null,
        remoteStream: null,
        peerConnection: null,
        isCaller: false,
        callConnectedAt: null,
        isMinimized: false,
      });

      sendSignal({
        type: "adhoc_upgrade",
        targetId: remoteUser.id,
        groupId: adhocId,
        groupName: "تماس چندنفره",
        callType,
        myInfo,
      });

      sendSignal({
        type: "group_call_join",
        targetId: targetUser.id,
        groupId: adhocId,
        groupName: "تماس چندنفره",
        callType,
        myInfo,
        participantIds: [remoteUser.id],
      });
      return;
    }

    const existingIds = Object.keys(state.groupParticipants);
    sendSignal({
      type: "group_call_join",
      targetId: targetUser.id,
      groupId: state.activeGroupId,
      groupName: state.activeGroupName,
      callType: state.groupCallType,
      myInfo,
      participantIds: existingIds,
    });
  },

  // ========================== ✅ NEW: کنترل کوچک/بزرگ‌شدن تماس (مشترک بین ۱به۱ و گروهی) ==========================
  minimizeCall: () => set({ isMinimized: true }),
  restoreCall: () => set({ isMinimized: false }),
  toggleCallMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

  // ========================== کنترل میکروفون ==========================
  toggleMic: () => {
    const { localStream, isMicMuted } = get();
    localStream?.getAudioTracks().forEach((track) => (track.enabled = isMicMuted));
    set({ isMicMuted: !isMicMuted });
  },

  // ========================== کنترل دوربین ==========================
  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    localStream?.getVideoTracks().forEach((track) => (track.enabled = isCameraOff));
    set({ isCameraOff: !isCameraOff });
  },

  // ========================== پیوستن/شروع تماس گروهی ==========================
  startGroupCall: async (group, myInfo, type, participantIds) => {
    const { groupCallStatus } = get();
    if (groupCallStatus !== "idle") return;

    get().connectCallSocket();

    let stream;
    try {
      stream = await acquireStream(get, { audio: true, video: type === "video" });
    } catch (err) {
      set({ callError: describeMediaError(err) });
      return;
    }

    set({
      localStream: stream,
      groupCallStatus: "in-call",
      groupCallType: type,
      activeGroupId: group.id,
      activeGroupName: group.name,
      groupParticipants: {},
      groupCallInvite: null,
      callError: null,
      pendingGroupCandidates: {},
      isMinimized: false,
    });

    if (participantIds && participantIds.length) {
      const { useAuthStore } = await import("./useAuthStore");
      const myId = useAuthStore.getState().authUser?.id;
      participantIds
        .filter((id) => String(id) !== String(myId))
        .forEach((id) => {
          sendSignal({
            type: "group_call_join",
            targetId: id,
            groupId: group.id,
            groupName: group.name,
            callType: type,
            myInfo,
          });
        });
    } else {
      sendSignal({
        type: "group_call_join",
        targetGroupId: group.id,
        groupName: group.name,
        callType: type,
        myInfo,
      });
    }
  },

  joinInvitedGroupCall: (myInfo) => {
    const { groupCallInvite, startGroupCall } = get();
    if (!groupCallInvite) return;
    startGroupCall(
      { id: groupCallInvite.groupId, name: groupCallInvite.groupName },
      myInfo,
      groupCallInvite.callType,
      groupCallInvite.participantIds
    );
  },

  dismissGroupCallInvite: () => set({ groupCallInvite: null }),

  // ========================== ترک کردن تماس گروهی ==========================
  leaveGroupCall: () => {
    const { activeGroupId, activeGroupName, groupCallType, groupParticipants, localStream } = get();

    if (activeGroupId) {
      sendSignal({ type: "group_call_leave", targetGroupId: activeGroupId });
    }

    if (activeGroupId) {
      const hadParticipants = Object.keys(groupParticipants).length > 0;
      logGroupCallToServer({
        groupId: activeGroupId,
        callType: groupCallType,
        status: hadParticipants ? "completed" : "no_answer",
      });
    }

    Object.values(groupParticipants).forEach((p) => p.pc?.close());
    stopStream(localStream);

    set({
      groupCallStatus: "idle",
      groupCallType: null,
      activeGroupId: null,
      activeGroupName: null,
      groupParticipants: {},
      localStream: null,
      isMicMuted: false,
      isCameraOff: false,
      pendingGroupCandidates: {},
      isMinimized: false,
    });
  },

  // ========================== مسیر پیام‌های تماس گروهی ==========================
  handleGroupSignal: (data) => {
    const { localStream, groupParticipants, groupCallStatus, activeGroupId } = get();

    switch (data.type) {
      case "adhoc_upgrade": {
        const { peerConnection, remoteStream, callType } = get();
        set({
          groupCallStatus: "in-call",
          groupCallType: data.callType || callType,
          activeGroupId: data.groupId,
          activeGroupName: data.groupName || "تماس چندنفره",
          groupParticipants: {
            [data.fromId]: { name: data.myInfo?.name, image: data.myInfo?.image, pc: peerConnection, stream: remoteStream },
          },
          callStatus: "idle",
          callType: null,
          remoteUser: null,
          remoteStream: null,
          peerConnection: null,
          isCaller: false,
          callConnectedAt: null,
          isMinimized: false,
        });
        break;
      }

      case "group_call_join": {
        const incomingGroupId = String(data.groupId || data.targetGroupId);
        const alreadyInThisCall =
          groupCallStatus === "in-call" && String(activeGroupId) === incomingGroupId;

        if (alreadyInThisCall) {
          const pc = createGroupPeerConnection(get, data.fromId, incomingGroupId);
          localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

          set((state) => ({
            groupParticipants: {
              ...state.groupParticipants,
              [data.fromId]: { name: data.myInfo?.name, image: data.myInfo?.image, pc, stream: null },
            },
          }));

          pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            sendSignal({
              type: "call_offer",
              targetId: data.fromId,
              groupId: incomingGroupId,
              sdp: offer,
            });
          });
        } else {
          set({
            groupCallInvite: {
              groupId: incomingGroupId,
              groupName: data.groupName,
              callType: data.callType,
              fromId: data.fromId,
              fromName: data.myInfo?.name,
              fromImage: data.myInfo?.image,
              participantIds: [...new Set([data.fromId, ...(data.participantIds || [])])],
            },
          });
        }
        break;
      }

      case "group_call_leave": {
        const p = groupParticipants[data.fromId];
        p?.pc?.close();
        set((state) => {
          const next = { ...state.groupParticipants };
          delete next[data.fromId];
          const nextPending = { ...state.pendingGroupCandidates };
          delete nextPending[data.fromId];
          return { groupParticipants: next, pendingGroupCandidates: nextPending };
        });
        break;
      }

      case "call_offer": {
        const pc = createGroupPeerConnection(get, data.fromId, data.groupId);
        localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

        set((state) => ({
          groupParticipants: {
            ...state.groupParticipants,
            [data.fromId]: { ...(state.groupParticipants[data.fromId] || {}), pc },
          },
        }));

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(async () => {
          get().flushPendingGroupCandidatesFor(data.fromId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({
            type: "call_answer",
            targetId: data.fromId,
            groupId: data.groupId,
            sdp: answer,
          });
        });
        break;
      }

      case "call_answer": {
        const p = groupParticipants[data.fromId];
        p?.pc?.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
          get().flushPendingGroupCandidatesFor(data.fromId);
        });
        break;
      }

      case "ice_candidate": {
        // ✅ FIX: صف‌بندی به‌جای شکست بی‌صدا، دقیقاً مثل حالت ۱به۱
        const p = groupParticipants[data.fromId];
        const pc = p?.pc;
        const candidate = new RTCIceCandidate(data.candidate);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          pc.addIceCandidate(candidate).catch((err) => console.error("ICE add error (group):", err));
        } else {
          set((state) => ({
            pendingGroupCandidates: {
              ...state.pendingGroupCandidates,
              [data.fromId]: [...(state.pendingGroupCandidates[data.fromId] || []), candidate],
            },
          }));
        }
        break;
      }

      default:
        break;
    }
  },

  // ✅ کمکی: صف candidate های یه شرکت‌کننده‌ی گروهی رو بعد از setRemoteDescription خالی می‌کنه
  flushPendingGroupCandidatesFor: (peerId) => {
    const { groupParticipants, pendingGroupCandidates } = get();
    const pc = groupParticipants[peerId]?.pc;
    const queued = pendingGroupCandidates[peerId];
    if (!pc || !queued || queued.length === 0) return;
    queued.forEach((c) => pc.addIceCandidate(c).catch((err) => console.error("ICE add error (group):", err)));
    set((state) => {
      const next = { ...state.pendingGroupCandidates };
      delete next[peerId];
      return { pendingGroupCandidates: next };
    });
  },
}));

// ========================== توابع کمکی (خارج از استور) ==========================

function describeMediaError(err) {
  switch (err?.name) {
    case "NotReadableError":
      return "دوربین یا میکروفون توسط برنامه‌ی دیگه‌ای در حال استفاده‌ست. برنامه‌های دیگه (مثل Zoom، Teams، یا همین تب دیگه) رو ببند و دوباره امتحان کن.";
    case "NotAllowedError":
      return "دسترسی به دوربین/میکروفون رد شد. از تنظیمات مرورگر اجازه بده.";
    case "NotFoundError":
      return "دوربین یا میکروفونی پیدا نشد.";
    default:
      return "خطا در دسترسی به دوربین/میکروفون.";
  }
}

async function logCallToServer({ receiverId, callType, status, duration }) {
  try {
    const token = localStorage.getItem("accessToken");
    await axios.post(
      `${CALL_API_BASE}/calls/`,
      { receiver: receiverId, call_type: callType, status, duration },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error("Error logging call:", err);
  }
}

async function logGroupCallToServer({ groupId, callType, status }) {
  try {
    const token = localStorage.getItem("accessToken");
    await axios.post(
      `${CALL_API_BASE}/group-calls/`,
      { group: groupId, call_type: callType, status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error("Error logging group call:", err);
  }
}

function createPeerConnection(get, targetId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: "ice_candidate",
        targetId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    useCallStore.setState({ remoteStream: event.streams[0] });
  };

  return pc;
}

function createGroupPeerConnection(get, peerId, groupId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: "ice_candidate",
        targetId: peerId,
        groupId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    useCallStore.setState((state) => ({
      groupParticipants: {
        ...state.groupParticipants,
        [peerId]: { ...(state.groupParticipants[peerId] || {}), stream: event.streams[0] },
      },
    }));
  };

  return pc;
}

// ✅ FIX: دیگه از get().socket نمی‌خونه (چون سوکت الان بیرون از استور و
// ماژول‌سطحه). export شده تا بقیه‌ی فایل‌ها هم در صورت نیاز مستقیم پیام
// بفرستن.
export function sendSignal(payload) {
  if (callSocket && callSocket.readyState === WebSocket.OPEN) {
    callSocket.send(JSON.stringify(payload));
  }
}