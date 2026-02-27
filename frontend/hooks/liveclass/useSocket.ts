// hooks/useSocket.ts
import { useEffect, useRef } from "react"
import { initSocket } from "@/lib/services/socket"
import type { Participant, ChatMessage } from "@/types/liveClass"

interface UseSocketProps {
  roomId: string
  user: any
  socket: any
  participants: Participant[]
  onParticipantsUpdate: (participant: any) => void
  onChatMessage: (message: ChatMessage) => void
  onHandRaise: (userId: string) => void
  onHandLower: (userId: string) => void
  onInstructorAction: (action: string, data: any) => void
}

export function useSocket({
  roomId,
  user,
  socket,
  participants,
  onParticipantsUpdate,
  onChatMessage,
  onHandRaise,
  onHandLower,
  onInstructorAction
}: UseSocketProps) {
  const socketRef = useRef(socket)
  const hasJoinedRef = useRef(false) // Track if we've already joined
  const handlersRef = useRef({
    onParticipantsUpdate,
    onChatMessage,
    onHandRaise,
    onHandLower,
    onInstructorAction
  })

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = {
      onParticipantsUpdate,
      onChatMessage,
      onHandRaise,
      onHandLower,
      onInstructorAction
    }
  }, [onParticipantsUpdate, onChatMessage, onHandRaise, onHandLower, onInstructorAction])

  useEffect(() => {
    if (!roomId || !socket) return

    // Only emit join if we haven't already joined this room
    if (!hasJoinedRef.current) {
      console.log("🔌 Joining room:", roomId)
      socket.emit("join", { roomId, classId: roomId, user })
      hasJoinedRef.current = true
    }

    const handleParticipantJoined = ({ userId, user: peerUser, socketId }: any) => {
      console.log("👤 Participant joined:", userId)
      handlersRef.current.onParticipantsUpdate({
        id: userId,
        socketId,
        name: `${peerUser.firstName} ${peerUser.lastName}`,
        firstName: peerUser.firstName,
        lastName: peerUser.lastName,
        isHandRaised: false,
        user: peerUser
      })
    }

    const handleParticipantLeft = ({ userId, socketId }: any) => {
      console.log("👋 Participant left:", userId)
      // You might want to add a callback for this
    }

    const handleClassJoined = ({ participants: existingParticipants, chatHistory }: any) => {
      console.log("✅ Class joined successfully with", existingParticipants.length, "participants")
      existingParticipants.forEach((p: any) => {
        handlersRef.current.onParticipantsUpdate({
          id: p.userId,
          socketId: p.socketId,
          name: `${p.user.firstName} ${p.user.lastName}`,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          isHandRaised: p.isHandRaised || false,
          isScreenSharing: p.isScreenSharing || false,
          user: p.user
        })
      })
      chatHistory?.forEach((msg: ChatMessage) => handlersRef.current.onChatMessage(msg))
    }

    const handleChatMessage = (message: ChatMessage) => {
      handlersRef.current.onChatMessage(message)
    }

    const handleHandRaised = ({ userId }: { userId: string }) => {
      handlersRef.current.onHandRaise(userId)
    }

    const handleHandLowered = ({ userId }: { userId: string }) => {
      handlersRef.current.onHandLower(userId)
    }

    const handleInstructorActionReceived = ({ action, instructorName }: { action: string; instructorName: string }) => {
      handlersRef.current.onInstructorAction(action, { instructorName })
    }

    // Set up event listeners
    socket.on("participant-joined", handleParticipantJoined)
    socket.on("participant-left", handleParticipantLeft)
    socket.on("chat-message", handleChatMessage)
    socket.on("hand-raised", handleHandRaised)
    socket.on("hand-lowered", handleHandLowered)
    socket.on("class-joined", handleClassJoined)
    socket.on("instructor-action-received", handleInstructorActionReceived)

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up socket listeners for room:", roomId)
      
      // Remove all event listeners
      socket.off("participant-joined", handleParticipantJoined)
      socket.off("participant-left", handleParticipantLeft)
      socket.off("chat-message", handleChatMessage)
      socket.off("hand-raised", handleHandRaised)
      socket.off("hand-lowered", handleHandLowered)
      socket.off("class-joined", handleClassJoined)
      socket.off("instructor-action-received", handleInstructorActionReceived)
      
      // Leave the room
      socket.emit("leave", { roomId })
      
      // Reset joined flag for next room
      hasJoinedRef.current = false
    }
  }, [roomId, socket, user]) // Only depend on roomId, socket, and user
}