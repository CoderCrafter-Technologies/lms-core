// src/lib/webrtc.js
import { getSocket } from "./socket";

const ICE_SERVERS = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    {
      urls: "turn:relay1.expressturn.com:3478",
      username: "efO8XQ995C6NTR8XA7",
      credential: "q4zPrbAEwJJH4720",
    },
  ],
};

let localStream = null;

/**
 * peersMap structure:
 * {
 *   [peerId]: {
 *     pc: RTCPeerConnection,
 *     queuedCandidates: RTCIceCandidateInit[],
 *     onTrack?: (MediaStream) => void
 *   }
 * }
 */
const peersMap = {};

export async function initWebRTC() {
  console.log("Requesting local media in webrtc.js...");

  const mobileVideoConstraints = {
    facingMode: "user",
    width: { ideal: 640, max: 1280 },
    height: { ideal: 360, max: 720 },
    frameRate: { ideal: 24, max: 30 },
  };

  const attempts = [
    { video: mobileVideoConstraints, audio: true },
    { video: true, audio: true },
    { video: false, audio: true },
    { video: mobileVideoConstraints, audio: false },
    { video: true, audio: false },
  ];

  for (const constraints of attempts) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Got local stream with constraints:", constraints);
      return localStream;
    } catch (error) {
      console.warn("getUserMedia failed for constraints:", constraints, error);
    }
  }

  localStream = new MediaStream();
  console.warn("Falling back to empty local stream (no mic/camera granted).");
  return localStream;
}

export function getLocalStream() {
  return localStream;
}

export function createOrGetPeer(peerId, onTrack) {
  if (peersMap[peerId]) {
    return peersMap[peerId].pc;
  }

  console.log("Creating peer for:", peerId);
  const pc = new RTCPeerConnection(ICE_SERVERS);

  const stream = localStream || new MediaStream();
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  if (stream.getTracks().length === 0) {
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });
  }

  pc.ontrack = (event) => {
    const stream = event.streams?.[0];
    console.log("Remote stream from", peerId, stream);
    if (stream && peersMap[peerId]?.onTrack) {
      peersMap[peerId].onTrack(stream);
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate to", peerId);
      getSocket().emit("signal", {
        target: peerId,
        signal: { candidate: event.candidate },
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`${peerId} connectionState:`, pc.connectionState);
  };

  peersMap[peerId] = {
    pc,
    queuedCandidates: [],
    onTrack,
  };

  return pc;
}

export async function setRemoteDescriptionSafely(peerId, desc) {
  const wrp = peersMap[peerId];
  if (!wrp) throw new Error(`Peer ${peerId} not found`);
  const pc = wrp.pc;

  // Avoid applying SDP twice in stable state with same type
  if (pc.remoteDescription && pc.signalingState === "stable") {
    console.warn(`⚠️ setRemoteDescription skipped for ${peerId} (already stable).`);
    return;
  }

  console.log("📝 setRemoteDescription for", peerId, desc.type);
  await pc.setRemoteDescription(new RTCSessionDescription(desc));

  // Flush queued candidates
  if (wrp.queuedCandidates.length) {
    console.log(`📬 Flushing ${wrp.queuedCandidates.length} queued ICE candidates for`, peerId);
    for (const c of wrp.queuedCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("❌ addIceCandidate (flushed) failed:", e);
      }
    }
    wrp.queuedCandidates = [];
  }
}

export async function addIceCandidateSafely(peerId, candidate) {
  const wrp = peersMap[peerId];
  if (!wrp) {
    console.warn(`⚠️ Candidate for unknown peer ${peerId}, ignoring.`);
    return;
  }
  const pc = wrp.pc;

  if (pc.remoteDescription) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("❌ Error adding ICE candidate", e);
    }
  } else {
    console.warn("⚠️ Remote description not set yet; queueing candidate for", peerId);
    wrp.queuedCandidates.push(candidate);
  }
}

export function removePeer(peerId) {
    const wrp = peersMap[peerId];
    if (!wrp) return;
  
    console.log("🔌 Closing peer:", peerId);
  
    try {
      wrp.pc.close();
    } catch (err) {
      console.error("Error closing peer:", err);
    }
  
    delete peersMap[peerId];
  }
