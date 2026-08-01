import { create } from "zustand";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALL_WS_URL = "ws://localhost:8000/ws/call/";

export const useCallStore = create((set, get) => ({
  // ---- وضعیت کلی تماس ----
  callStatus: "idle", // idle | calling | ringing | connected
  callType: null, // "audio" | "video"
  remoteUser: null, // اطلاعات کاربر طرف مقابل تماس
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,

  // ---- اتصالات داخلی (نه استیت React، فقط رفرنس) ----
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

  // ========================== شروع تماس (طرف تماس‌گیرنده) ==========================
  startCall: async (targetUser, type) => {
    const { socket, connectCallSocket } = get();
    if (!socket) connectCallSocket();

    set({ callStatus: "calling", callType: type, remoteUser: targetUser });

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
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

  // ========================== دریافت تماس ورودی ==========================
  handleSignal: (data) => {
    switch (data.type) {
      case "call_offer":
        set({
          callStatus: "ringing",
          callType: data.callType,
          incomingOffer: data,
          remoteUser: { id: data.fromId, name: data.callerInfo?.name, image: data.callerInfo?.image },
        });
        break;

      case "call_answer":
        get().peerConnection?.setRemoteDescription(new RTCSessionDescription(data.sdp));
        set({ callStatus: "connected" });
        break;

      case "ice_candidate":
        get().peerConnection?.addIceCandidate(new RTCIceCandidate(data.candidate));
        break;

      case "call_end":
        get().endCall(false);
        break;

      case "call_reject":
        set({ callStatus: "idle", remoteUser: null });
        break;

      default:
        break;
    }
  },

  // ========================== قبول کردن تماس ورودی ==========================
  acceptCall: async () => {
    const { incomingOffer, remoteUser } = get();
    if (!incomingOffer) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: incomingOffer.callType === "video",
    });
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

    set({ callStatus: "connected" });
  },

  // ========================== رد کردن تماس ورودی ==========================
  rejectCall: () => {
    const { remoteUser } = get();
    if (remoteUser) {
      sendSignal(get, { type: "call_reject", targetId: remoteUser.id });
    }
    set({ callStatus: "idle", remoteUser: null, incomingOffer: null });
  },

  // ========================== پایان دادن به تماس ==========================
  endCall: (notifyOther = true) => {
    const { peerConnection, localStream, remoteUser } = get();

    if (notifyOther && remoteUser) {
      sendSignal(get, { type: "call_end", targetId: remoteUser.id });
    }

    peerConnection?.close();
    localStream?.getTracks().forEach((track) => track.stop());

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
    });
  },

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
}));

// ========================== توابع کمکی (خارج از استور) ==========================

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

function sendSignal(get, payload) {
  const { socket } = get();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}