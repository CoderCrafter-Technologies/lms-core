// src/lib/socket.js
import { io } from "socket.io-client";

let socket: ReturnType<typeof io> | null = null;
let consumers = 0;

const resolveSocketUrl = (serverUrl?: string) => {
  if (typeof window === "undefined") {
    return serverUrl || "http://localhost:5000";
  }

  const { origin, port, protocol, hostname } = window.location;
  const isDefaultPort = !port || port === "80" || port === "443";

  if (isDefaultPort) {
    return origin;
  }

  if (serverUrl) {
    try {
      const parsed = new URL(serverUrl);
      const isLocalHost =
        ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname) &&
        !["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
      if (!isLocalHost) {
        return serverUrl;
      }
    } catch {
      return serverUrl;
    }
  }

  const fallbackProtocol = protocol || "http:";
  return `${fallbackProtocol}//${hostname}:5000`;
};

export function initSocket(serverUrl?: string) {
  const resolvedUrl = resolveSocketUrl(serverUrl);
  if (!socket) {
    socket = io(resolvedUrl, {
      transports: ["websocket"],
    });
  }
  consumers += 1;
  return socket;
}

export function getSocketUrl(serverUrl?: string) {
  return resolveSocketUrl(serverUrl);
}

export function getSocket() {
  if (!socket) {
    throw new Error("Socket not initialized. Call initSocket() first.");
  }
  return socket;
}

export function releaseSocket() {
  consumers = Math.max(consumers - 1, 0);
  if (consumers === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}
