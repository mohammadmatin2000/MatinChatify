import { create } from "zustand";
import axios from "axios";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALL_WS_URL = "ws://localhost:8000/ws/call/";
const CALL_API_BASE = "http://localhost:8000/call";

// ✅ FIX: توقف امن یه استریم — همیشه قبل از گرفتن استریم جدید صدا زده می‌شه
// تا دوربین/میکروفون قفل‌شده از تماس قبلی آزاد بشه
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

// ✅ FIX: getUserMedia با try/catch — دیگه Uncaught promise rejection نمی‌ده،
// و همیشه اول استریم قبلی (اگه بوده) رو آزاد می‌کنه
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

export const useCallStore = create((set, get) => ({
  // ---- وضعیت کلی تماس دو نفره ----
  callStatus: "idle", // idle | calling | ringing | connected
  callType: null, // "audio" | "video"
  remoteUser: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,
  callError: null, // پیام خطا برای نمایش به کاربر (به‌جای کرش خاموش)

  // ✅ NEW: برای اینکه بدونیم این کاربر تماس‌گیرنده بوده یا گیرنده،
  // و کِی وصل شده تا مدت زمان تماس محاسبه بشه
  isCaller: false,
  callConnectedAt: null,

  // ---- وضعیت تماس گروهی (mesh) ----
  groupCallStatus: "idle", // idle | in-call
  groupCallType: null,
  activeGroupId: null,
  activeGroupName: null,
  groupParticipants: {},
  groupCallInvite: null,

  // ---- اتصالات داخلی ----
  socket: null,
  peerConnection: null,
  incomingOffer: null,

  // ========================== اتصال به سرور سیگنالینگ ==========================
  connectCallSocket: () => {
    if (get().socket) return;

    const token = localStorage.getItem("accessToken");
    const socket = new WebSocket(`${CALL_WS_URL}?token=${token}`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      get().handleSignal(data);
    };

    socket.onclose = () => {
      set({ socket: null });
    };

    set({ socket });
  },

  // ========================== شروع تماس دو نفره (طرف تماس‌گیرنده) ==========================
  startCall: async (targetUser, type) => {
    // ✅ FIX: گارد — اگه از قبل تو یه تماسی، دوباره شروع نکن
    if (get().callStatus !== "idle") {
      console.warn("⚠️ Already in a call, ignoring startCall");
      return;
    }

    const { socket, connectCallSocket } = get();
    if (!socket) connectCallSocket();

    // ✅ NEW: این کاربر تماس‌گیرنده‌ست
    set({
      callStatus: "calling",
      callType: type,
      remoteUser: targetUser,
      callError: null,
      isCaller: true,
      callConnectedAt: null,
    });

    let stream;
    try {
      stream = await acquireStream(get, { audio: true, video: type === "video" });
    } catch (err) {
      // ✅ FIX: به‌جای رها کردن state، برمی‌گردونیم idle و خطا رو نگه می‌داریم
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

    sendSignal(get, {
      type: "call_offer",
      targetId: targetUser.id,
      callType: type,
      sdp: offer,
      callerInfo: { name: targetUser.myName, image: targetUser.myImage },
    });
  },

  // ========================== دریافت پیام سیگنالینگ ==========================
  handleSignal: (data) => {
    if (data.groupId || data.targetGroupId || data.type?.startsWith("group_call_")) {
      get().handleGroupSignal(data);
      return;
    }

    switch (data.type) {
      case "call_offer":
        // ✅ FIX: اگه از قبل تو یه تماسیم، offer جدید رو نادیده بگیر (یا می‌تونی بعداً "busy" بفرستی)
        if (get().callStatus !== "idle") {
          sendSignal(get, { type: "call_reject", targetId: data.fromId });
          return;
        }
        set({
          callStatus: "ringing",
          callType: data.callType,
          incomingOffer: data,
          remoteUser: { id: data.fromId, name: data.callerInfo?.name, image: data.callerInfo?.image },
          isCaller: false, // ✅ NEW: این کاربر گیرنده‌ی تماسه
          callConnectedAt: null,
        });
        break;

      case "call_answer":
        get().peerConnection?.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // ✅ NEW: زمان وصل شدن رو ثبت می‌کنیم تا مدت تماس محاسبه بشه
        set({ callStatus: "connected", callConnectedAt: Date.now() });
        break;

      case "ice_candidate":
        get().peerConnection?.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        break;

      case "call_end":
        get().endCall(false);
        break;

      case "call_reject": {
        // ✅ NEW: اگه خودمون تماس‌گیرنده بودیم و طرف رد کرد، به‌عنوان "رد شده" ثبت کن
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

  // ========================== قبول کردن تماس دو نفره ورودی ==========================
  acceptCall: async () => {
    const { incomingOffer, remoteUser, callStatus } = get();
    // ✅ FIX: گارد — فقط وقتی واقعاً داره زنگ می‌خوره قبول کن
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
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendSignal(get, {
      type: "call_answer",
      targetId: remoteUser.id,
      sdp: answer,
    });

    // ✅ NEW: زمان وصل شدن سمت گیرنده هم ثبت می‌شه
    set({ callStatus: "connected", callConnectedAt: Date.now() });
  },

  // ========================== رد کردن تماس دو نفره ورودی ==========================
  rejectCall: () => {
    const { remoteUser } = get();
    if (remoteUser) {
      sendSignal(get, { type: "call_reject", targetId: remoteUser.id });
    }
    // نکته: چون گیرنده‌ی تماس initiator نیست، رکورد رو ثبت نمی‌کنه —
    // این کار رو سمت تماس‌گیرنده وقتی call_reject دریافت می‌کنه انجام می‌دیم (بالا در handleSignal)
    set({ callStatus: "idle", remoteUser: null, incomingOffer: null, isCaller: false, callConnectedAt: null });
  },

  // ========================== پایان دادن به تماس دو نفره ==========================
  endCall: (notifyOther = true) => {
    const { peerConnection, localStream, remoteUser, callStatus, isCaller, callConnectedAt, callType } = get();

    if (notifyOther && remoteUser) {
      sendSignal(get, { type: "call_end", targetId: remoteUser.id });
    }

    // ✅ NEW: فقط تماس‌گیرنده (initiator) رکورد رو تو دیتابیس ثبت می‌کنه
    // تا هر تماس فقط یک‌بار (نه دوبار، یکبار از هرکدوم از طرفین) ذخیره بشه
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
    stopStream(localStream); // ✅ FIX: از تابع مشترک استفاده شد

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
      isCaller: false, // ✅ NEW
      callConnectedAt: null, // ✅ NEW
    });
  },

  clearCallError: () => set({ callError: null }),

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
  startGroupCall: async (group, myInfo, type) => {
    const { socket, connectCallSocket, groupCallStatus } = get();
    if (groupCallStatus !== "idle") return;
    if (!socket) connectCallSocket();

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
    });

    sendSignal(get, {
      type: "group_call_join",
      targetGroupId: group.id,
      groupName: group.name,
      callType: type,
      myInfo,
    });
  },

  joinInvitedGroupCall: (myInfo) => {
    const { groupCallInvite, startGroupCall } = get();
    if (!groupCallInvite) return;
    startGroupCall(
      { id: groupCallInvite.groupId, name: groupCallInvite.groupName },
      myInfo,
      groupCallInvite.callType
    );
  },

  dismissGroupCallInvite: () => set({ groupCallInvite: null }),

  // ========================== ترک کردن تماس گروهی ==========================
  leaveGroupCall: () => {
    const { activeGroupId, activeGroupName, groupCallType, groupParticipants, localStream } = get();

    if (activeGroupId) {
      sendSignal(get, { type: "group_call_leave", targetGroupId: activeGroupId });
    }

    // ✅ NEW: ثبت تماس گروهی — چون mesh هست و initiator مشخصی نداریم اینجا،
    // هر کاربر خروج خودش رو به‌عنوان یک شرکت‌کننده ثبت می‌کنه.
    // (این یک رکورد ساده‌ست؛ برای منطق دقیق‌تر initiator باید جدا مشخص بشه)
    if (activeGroupId) {
      const hadParticipants = Object.keys(groupParticipants).length > 0;
      logGroupCallToServer({
        groupId: activeGroupId,
        callType: groupCallType,
        status: hadParticipants ? "completed" : "no_answer",
      });
    }

    Object.values(groupParticipants).forEach((p) => p.pc?.close());
    stopStream(localStream); // ✅ FIX

    set({
      groupCallStatus: "idle",
      groupCallType: null,
      activeGroupId: null,
      activeGroupName: null,
      groupParticipants: {},
      localStream: null,
      isMicMuted: false,
      isCameraOff: false,
    });
  },

  // ========================== مسیر پیام‌های تماس گروهی ==========================
  handleGroupSignal: (data) => {
    const { localStream, groupParticipants, groupCallStatus, activeGroupId } = get();

    switch (data.type) {
      case "group_call_join": {
        const incomingGroupId = String(data.targetGroupId);
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
            sendSignal(get, {
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
          return { groupParticipants: next };
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
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(get, {
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
        p?.pc?.setRemoteDescription(new RTCSessionDescription(data.sdp));
        break;
      }

      case "ice_candidate": {
        const p = groupParticipants[data.fromId];
        p?.pc?.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        break;
      }

      default:
        break;
    }
  },
}));

// ========================== توابع کمکی (خارج از استور) ==========================

// پیام خطای قابل‌فهم برای کاربر، به‌جای اینکه فقط توی کنسول بمونه
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

// ✅ NEW: ثبت یک تماس خصوصی در بک‌اند
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

// ✅ NEW: ثبت یک تماس گروهی در بک‌اند
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
      sendSignal(get, {
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
      sendSignal(get, {
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

function sendSignal(get, payload) {
  const { socket } = get();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}