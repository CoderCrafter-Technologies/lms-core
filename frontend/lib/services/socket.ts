// src/lib/socket.js
import { io } from "socket.io-client";

let socket = null;
let consumers = 0;

export function initSocket(serverUrl = "http://localhost:5000") {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ["websocket"],
    });
  }
  consumers += 1;
  return socket;
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
