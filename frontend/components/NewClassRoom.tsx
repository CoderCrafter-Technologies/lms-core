"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import {
  MicrophoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  UserGroupIcon,
  HandRaisedIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline"
import {
  MicrophoneIcon as MicrophoneIconSolid,
  VideoCameraSlashIcon,
  HandRaisedIcon as HandRaisedIconSolid,
} from "@heroicons/react/24/solid"
import VideoGrid from "./VideoGrid"
import { initSocket } from "@/lib/services/socket"
import {
  initWebRTC,
  getLocalStream,
  createOrGetPeer,
  setRemoteDescriptionSafely,
  addIceCandidateSafely,
  removePeer,
} from "@/lib/services/webrtc"
import { isInstructor } from "@/lib/utils"
import { toast } from "sonner"

interface LiveClassRoomProps {
  classData: any
  user: any
  enrollmentId: string
  onLeave: () => void
}

interface Participant {
  id: string // userId
  socketId: string
  name: string
  firstName?: string
  lastName?: string
  isHandRaised: boolean
  isSpeaking?: boolean
  isScreenSharing?: boolean
  speakingLevel?: number
  camOn?: boolean
  audioOn?: boolean
  user: any // Complete user object with role information
}

interface ChatMessage {
  id: string
  message: string
  from: any
  timestamp: Date
  type: string
}

// Teams-style Pre-join Modal Component
const TeamsPreJoinModal = ({
  onConfirm,
  onCancel,
  classData,
}: {
  onConfirm: (preferences: { micOn: boolean; camOn: boolean }) => void
  onCancel: () => void
  classData: any
}) => {
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Get preview stream
    const getPreviewStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setPreviewStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error("Error getting preview stream:", error)
      }
    }

    getPreviewStream()

    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleJoin = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop())
    }
    onConfirm({ micOn, camOn })
  }

  return (
    <div className="teams-modal-overlay">
      <div className="teams-modal max-w-lg">
        <div className="teams-modal-header">Join "{classData?.name || "Meeting"}"</div>

        <div className="teams-modal-content">
          {/* Video Preview */}
          <div className="relative mb-6">
            <video ref={videoRef} autoPlay muted playsInline className="teams-preview-video" />
            {!camOn && (
              <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-2 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {classData?.user?.firstName?.charAt(0) || "U"}
                  </div>
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}

            {/* Preview Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <button
                onClick={() => setCamOn(!camOn)}
                className={`teams-btn-icon ${!camOn ? "video-off" : ""}`}
                title={camOn ? "Turn off camera" : "Turn on camera"}
              >
                {camOn ? <VideoCameraIcon className="w-5 h-5" /> : <VideoCameraSlashIcon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setMicOn(!micOn)}
                className={`teams-btn-icon ${!micOn ? "muted" : ""}`}
                title={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                {micOn ? <MicrophoneIcon className="w-5 h-5" /> : <MicrophoneIconSolid className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="teams-toggle">
              <div className={`teams-switch ${micOn ? "active" : ""}`} onClick={() => setMicOn(!micOn)}>
                <div className="teams-switch-thumb"></div>
              </div>
              <span className="text-sm">Microphone</span>
            </div>

            <div className="teams-toggle">
              <div className={`teams-switch ${camOn ? "active" : ""}`} onClick={() => setCamOn(!camOn)}>
                <div className="teams-switch-thumb"></div>
              </div>
              <span className="text-sm">Camera</span>
            </div>
          </div>
        </div>

        <div className="teams-modal-actions">
          <button onClick={onCancel} className="teams-btn teams-btn-secondary">
            Cancel
          </button>
          <button onClick={handleJoin} className="teams-btn teams-btn-primary">
            Join now
          </button>
        </div>
      </div>
    </div>
  )
}

// Teams-style Chat Panel
const TeamsChatPanel = ({
  messages,
  onSendMessage,
  onClose,
}: {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  onClose: () => void
}) => {
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage)
      setNewMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-x-2 top-16 bottom-24 w-auto rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] flex flex-col z-30 animate-slide-in overflow-hidden md:inset-x-auto md:right-3 md:top-20 md:bottom-24 md:w-[22rem] md:rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)] tracking-wide">Chat</h3>
        <button 
          onClick={onClose} 
          className="w-8 h-8 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center justify-center transition-all"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ChatBubbleLeftIcon className="w-12 h-12 text-[var(--color-text-muted)] mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">No messages yet</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              {/* Sender info */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xs font-semibold text-white">
                  {message.from?.firstName?.charAt(0)}{message.from?.lastName?.charAt(0)}
                </div>
                <span className="text-xs font-medium text-[var(--color-text)]">
                  {message.from?.firstName} {message.from?.lastName}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {/* Message bubble */}
              <div className="ml-8 px-3 py-2 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text)]">{message.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent transition-all"
          />
          <button 
            onClick={handleSend} 
            disabled={!newMessage.trim()} 
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all hover:scale-[1.03] disabled:hover:scale-100"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// Teams-style Participants Panel
const TeamsParticipantsPanel = ({
  participants,
  user,
  onClose,
  onMuteStudent,
  onUnmuteStudent,
  onDisconnectStudent,
}: {
  participants: Participant[]
  user: any
  onClose: () => void
  onMuteStudent?: (userId: string) => void
  onUnmuteStudent?: (userId: string) => void
  onDisconnectStudent?: (userId: string) => void
}) => {
  const isUserInstructor = isInstructor(user)

  const getParticipantInitials = (participant: Participant) => {
    return `${participant.firstName?.charAt(0) || ""}${participant.lastName?.charAt(0) || ""}`.toUpperCase()
  }

  const getTeamsAvatarColor = (name: string) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-purple-500 to-purple-600",
      "from-green-500 to-green-600",
      "from-red-500 to-red-600",
      "from-yellow-500 to-yellow-600",
      "from-pink-500 to-pink-600",
      "from-indigo-500 to-indigo-600",
      "from-cyan-500 to-cyan-600",
    ]
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  return (
    <div className="fixed inset-x-2 top-16 bottom-24 w-auto rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] flex flex-col z-30 animate-slide-in overflow-hidden md:inset-x-auto md:right-3 md:top-20 md:bottom-24 md:w-[22rem] md:rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Participants ({participants.length})</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2.5 scrollbar-thin scrollbar-track-transparent">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="p-3 rounded-xl hover:bg-[var(--color-surface-muted)] border border-transparent hover:border-[var(--color-border)] transition-all duration-200 mb-1 group"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${getTeamsAvatarColor(participant.name)} flex items-center justify-center text-white font-medium text-sm shadow-lg`}>
                {getParticipantInitials(participant)}
                {/* Speaking indicator */}
                {participant.speakingLevel > 20 && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-success rounded-full border-2 border-surface-1 animate-pulse" />
                )}
              </div>

              {/* Participant Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)] truncate">
                    {participant.name}
                  </span>
                  {participant.id === user.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">You</span>
                  )}
                </div>
                {/* Status badges */}
                <div className="flex items-center gap-1.5 mt-1">
                  {participant.isHandRaised && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <HandRaisedIcon className="w-3 h-3" />
                      <span>Hand raised</span>
                    </div>
                  )}
                  {participant.isScreenSharing && (
                    <div className="flex items-center gap-1 text-xs text-accent-success">
                      <ComputerDesktopIcon className="w-3 h-3" />
                      <span>Presenting</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions for Instructor */}
              {isUserInstructor && participant.id !== user.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onMuteStudent?.(participant.id)}
                    className="w-7 h-7 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] flex items-center justify-center transition-all"
                    title="Mute participant"
                  >
                    <MicrophoneIconSolid className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  </button>
                  <button
                    onClick={() => onDisconnectStudent?.(participant.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all"
                    title="Remove participant"
                  >
                    <XMarkIcon className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <p className="text-xs text-[var(--color-text-tertiary)] text-center">
          {participants.length} participant{participants.length !== 1 ? "s" : ""} in meeting
        </p>
      </div>
    </div>
  )
}

export default function NewLiveClassRoom({ classData, user, enrollmentId, onLeave }: LiveClassRoomProps) {
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [isSharing, setIsSharing] = useState(false)
  const [peers, setPeers] = useState({})
  const [roomId, setRoomId] = useState(null)
  const [joined, setJoined] = useState(false)
  const [showPreJoinModal, setShowPreJoinModal] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [participants, setParticipants] = useState([])
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [zoomedParticipant, setZoomedParticipant] = useState(null)
  const [screenSharingPeer, setScreenSharingPeer] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [layoutMode, setLayoutMode] = useState<"spotlight" | "grid" | "sidebar">("spotlight")

  const socketRef = useRef(null)
  const localStreamRef = useRef(null)
  const peersRef = useRef({})
  const chatContainerRef = useRef(null)
  const micOnRef = useRef(micOn)
  const roomIdRef = useRef(roomId)
  const participantsRef = useRef(participants)
  const voiceCleanupRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    if (!classData) return
    console.log(user, "User")
    setRoomId(classData.roomId)
  }, [classData])

  useEffect(() => {
    micOnRef.current = micOn
  }, [micOn])

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  useEffect(() => {
    return () => {
      voiceCleanupRef.current?.()
      voiceCleanupRef.current = null
    }
  }, [])

  const setLocalVideoTracksEnabled = (enabled: boolean) => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  const applyCameraState = (enabled: boolean, shouldEmit = true) => {
    setCamOn(enabled)
    setLocalVideoTracksEnabled(enabled)

    if (shouldEmit && socketRef.current && roomIdRef.current) {
      socketRef.current.emit("toggle-video", {
        roomId: roomIdRef.current,
        camOn: enabled,
      })
    }
  }

  const handlePreJoinConfirm = (preferences: { micOn: boolean; camOn: boolean }) => {
    setMicOn(preferences.micOn)
    setCamOn(preferences.camOn)
    setShowPreJoinModal(false)
    setJoined(true)
  }

  const handleToggleCamera = () => {
    applyCameraState(!camOn, true)
  }


  const handlePreJoinCancel = () => {
    onLeave() // Return to previous page
  }

  useEffect(() => {
    if (!joined) return
    console.log("🔌 Joining room:", classData.roomId)
    const socket = process.env.NEXT_PUBLIC_SOCKET_URL ? initSocket(process.env.NEXT_PUBLIC_SOCKET_URL) : initSocket()
    socketRef.current = socket
    ;(async () => {
      // Get local cam/mic with initial preferences
      const stream = await initWebRTC()
      localStreamRef.current = stream

      // Apply pre-join preferences immediately
      if (stream) {
        console.log("Applying pre-join preferences:", { micOn, camOn })
        stream.getAudioTracks().forEach((track) => {
          track.enabled = micOn
          console.log("Audio track enabled:", track.enabled)
        })
        stream.getVideoTracks().forEach((track) => {
          track.enabled = camOn
          console.log("Video track enabled:", track.enabled)
        })
      }

      // 🔥 START VOICE DETECTION HERE
      if (stream && micOn) {
        voiceCleanupRef.current?.()
        voiceCleanupRef.current = setupVoiceDetection(stream)
      }


      // Add current user to participants
      setParticipants((prev) => [
        ...prev,
        {
          id: user.id, // Use userId as primary ID
          socketId: socket.id, // Store socketId separately
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          isHandRaised: false,
          user: user, // Preserve complete user object with role info
        },
      ])

      // Socket event handlers remain the same as your original
      socket.on("participant-joined", async ({ userId, user: peerUser, socketId }) => {
        console.log("👤 Participant joined:", userId, "with socket:", socketId)
        // Add to participants list using userId as primary ID
        setParticipants((prev) => {
          const existing = prev.find((p) => p.id === userId)
          if (existing) {
            return prev.map((p) =>
              p.id === userId
                ? {
                    ...p,
                    socketId: socketId || p.socketId,
                    firstName: peerUser?.firstName ?? p.firstName,
                    lastName: peerUser?.lastName ?? p.lastName,
                    name: `${peerUser?.firstName ?? p.firstName ?? ""} ${peerUser?.lastName ?? p.lastName ?? ""}`.trim() || p.name,
                    user: peerUser || p.user,
                  }
                : p,
            )
          }
          return [
            ...prev,
            {
              id: userId,
              socketId: socketId,
              name: `${peerUser.firstName} ${peerUser.lastName}`,
              firstName: peerUser.firstName,
              lastName: peerUser.lastName,
              isHandRaised: false,
              camOn: true,
              audioOn: true,
              speakingLevel: 0,
              user: peerUser, // Preserve complete user object with role info
            },
          ]
        })

        const pc = createOrGetPeer(socketId, (remoteStream) => {
          setPeers((prev) => ({ ...prev, [socketId]: { pc, stream: remoteStream } }))
          peersRef.current[socketId] = pc
        })
        peersRef.current[socketId] = pc

        // Caller: create offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit("signal", { target: socketId, signal: { sdp: pc.localDescription } })
      })

      socket.on("signal", async ({ from, signal }) => {
        console.log("📡 Signal from", from, signal)
        // Always ensure one pc per peer using socketId
        const pc = createOrGetPeer(from, (remoteStream) => {
          setPeers((prev) => ({ ...prev, [from]: { pc, stream: remoteStream } }))
          peersRef.current[from] = pc
        })
        peersRef.current[from] = pc

        if (signal.sdp) {
          await setRemoteDescriptionSafely(from, signal.sdp)
          if (signal.sdp.type === "offer") {
            // Callee: answer
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit("signal", { target: from, signal: { sdp: pc.localDescription } })
          }
        } else if (signal.candidate) {
          await addIceCandidateSafely(from, signal.candidate)
        }
      })

      socket.on("peer-left", ({ peerId, userId }) => {
        console.log("❌ Peer left (WebRTC):", peerId, "userId:", userId)
        cleanupPeerConnection(peerId, userId)
      })

      socket.on("participant-left", ({ userId, socketId }) => {
        console.log("❌ Participant left:", userId, "socketId:", socketId)
        // Use the cleanup helper function
        if (socketId) {
          cleanupPeerConnection(socketId, userId)
        } else {
          // Fallback if socketId not provided - try to find it
          const participant = participantsRef.current.find((p) => p.id === userId)
          if (participant) {
            cleanupPeerConnection(participant.socketId, userId)
          } else {
            // Last resort - just remove from participants
            setParticipants((prev) => prev.filter((p) => p.id !== userId))
          }
        }
      })

      socket.on("chat-message", (message: ChatMessage) => {
        setMessages((prev) => [...prev, message])
        // Auto-scroll to bottom when new message arrives
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
          }
        }, 100)
      })

      socket.on("hand-raised", ({ userId }) => {
        setParticipants((prev) => prev.map((p) => (p.id === userId ? { ...p, isHandRaised: true } : p)))
      })

      socket.on("hand-lowered", ({ userId }) => {
        setParticipants((prev) => prev.map((p) => (p.id === userId ? { ...p, isHandRaised: false } : p)))
      })

      socket.on("class-joined", ({ participants: existingParticipants, chatHistory }) => {
        console.log("✅ Joined class successfully with", existingParticipants.length, "existing participants")
        setMessages(chatHistory || [])

        // Add existing participants to state
        existingParticipants.forEach((participant) => {
          setParticipants((prev) => {
            if (prev.some((p) => p.id === participant.userId)) return prev
            return [
              ...prev,
              {
                id: participant.userId,
                socketId: participant.socketId,
                name: `${participant.user.firstName} ${participant.user.lastName}`,
                firstName: participant.user.firstName,
                lastName: participant.user.lastName,
                isHandRaised: participant.isHandRaised || false,
                isScreenSharing: participant.isScreenSharing || false,
                camOn: participant.camOn !== undefined ? participant.camOn : (participant.isVideoEnabled !== undefined ? participant.isVideoEnabled : true),
                audioOn: participant.audioOn !== undefined ? participant.audioOn : (participant.isAudioEnabled !== undefined ? participant.isAudioEnabled : true),
                speakingLevel: participant.speakingLevel || 0,
                user: participant.user, // Preserve complete user object with role info
              },
            ]
          })
        })
      });

      socket.on("participant-video-toggled", ({ userId, camOn }) => {
        setParticipants(prev =>
          prev.map(p =>
            p.id === userId
              ? { ...p, camOn }
              : p
          )
        )
      });

      socket.on("participant-speaking-level", ({ userId, level }) => {
        console.log("User speaking leve: ", level)
        setParticipants(prev =>
          prev.map(p =>
            p.id === userId
              ? { ...p, speakingLevel: level }
              : p
          )
        )
      })



      socket.on("screen-share-started", ({ userId, socketId }) => {
        console.log("🖥️ Screen sharing started by:", userId)
        setScreenSharingPeer(socketId)
        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isScreenSharing: p.id === userId,
          })),
        )
        // Auto-zoom the screen sharing participant
        setZoomedParticipant(socketId)
      })

      socket.on("screen-share-stopped", ({ userId, socketId }) => {
        console.log("🛑 Screen sharing stopped by:", userId)
        setScreenSharingPeer(null)
        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isScreenSharing: false,
          })),
        )
        // Remove zoom if this was the zoomed participant
        if (zoomedParticipant === socketId) {
          setZoomedParticipant(null)
        }
      })

      // Instructor action responses
      socket.on("instructor-action-performed", ({ action, targetUserId, success }) => {
        console.log(`Instructor action ${action} for ${targetUserId}: ${success ? "success" : "failed"}`)
        if (success) {
          switch (action) {
            case "disconnect":
              console.log(`🔌 Instructor disconnect successful for ${targetUserId}, cleaning up...`)
              // Find the participant to get their socketId
              const disconnectedParticipant = participantsRef.current.find((p) => p.id === targetUserId)
              if (disconnectedParticipant) {
                const socketId = disconnectedParticipant.socketId
                cleanupPeerConnection(socketId, targetUserId)
              } else {
                // Fallback cleanup if participant not found in state
                console.warn(`⚠️ Participant ${targetUserId} not found in state, doing partial cleanup`)
                setParticipants((prev) => prev.filter((p) => p.id !== targetUserId))
              }
              break
            case "stop-screen-share":
              // Update screen sharing state
              setParticipants((prev) => prev.map((p) => (p.id === targetUserId ? { ...p, isScreenSharing: false } : p)))
              break
          }
        }
      })

      // Handle being targeted by instructor actions (for students)
      socket.on("instructor-action-received", ({ action, instructorName }) => {
        switch (action) {
          case "disconnect":
            toast.error(`You have been disconnected by instructor ${instructorName}.`)
            handleLeave()
            break
          case "mute":
            setMicOn(false)
            toast.warning(`You have been muted by instructor ${instructorName}.`)
            break
          case "unmute":
            setMicOn(true)
            toast.success(`You have been unmuted by instructor ${instructorName}.`)
            break
          case "stop-screen-share":
            if (isSharing) {
              handleStopShare()
              toast.warning(`Your screen sharing was stopped by instructor ${instructorName}.`)
            }
            break
          case "disable-video":
            applyCameraState(false, true)
            toast.warning(`Your camera was turned off by instructor ${instructorName}.`)
            break
          case "enable-video":
            applyCameraState(true, true)
            toast.success(`Your camera was turned on by instructor ${instructorName}.`)
            break
        }
      })

      console.log("📡 Emitting join for room:", classData.roomId)
      socket.emit("join", {
        roomId: classData.roomId,
        classId: classData.id,
        user,
      })
    })()

    return () => {
      console.log("🧹 Cleaning up...")
      voiceCleanupRef.current?.()
      voiceCleanupRef.current = null
      try {
        if (socketRef.current) {
          socketRef.current.emit("leave", { roomId: classData.roomId })
          socketRef.current.disconnect()
        }
      } catch {}
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      Object.keys(peersRef.current).forEach((id) => removePeer(id))
      peersRef.current = {}
      setPeers({})
      setParticipants([])
    }
  }, [joined, roomId])

  const cleanupPeerConnection = (socketId: string, userId?: string) => {
    console.log(`🧹 Cleaning up peer connection for socket ${socketId}, user ${userId}`)

    // Clean up WebRTC peer connection
    if (peersRef.current[socketId]) {
      removePeer(socketId)
      delete peersRef.current[socketId]
    }

    // Remove from peers state
    setPeers((prev) => {
      const copy = { ...prev }
      delete copy[socketId]
      return copy
    })

    // Clear zoom if this participant was zoomed
    if (zoomedParticipant === socketId) {
      setZoomedParticipant(null)
    }

    // Clear screen sharing if this participant was sharing
    if (screenSharingPeer === socketId) {
      setScreenSharingPeer(null)
    }

    // Remove from participants list
    if (userId) {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.id !== userId && p.socketId !== socketId)
        console.log(`👥 Participant ${userId}/${socketId} removed. Remaining: ${filtered.length}`)
        return filtered
      })
    }
  }

  useEffect(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn))
  }, [micOn])

  useEffect(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = camOn));
    
  }, [camOn])

  useEffect(() => {
    if (!joined || !localStreamRef.current) return

    voiceCleanupRef.current?.()
    voiceCleanupRef.current = null

    if (micOn) {
      voiceCleanupRef.current = setupVoiceDetection(localStreamRef.current)
    } else if (roomIdRef.current) {
      socketRef.current?.emit("speaking-level", {
        roomId: roomIdRef.current,
        level: 0,
      })
    }
  }, [joined, micOn, roomId])

  const handleShareScreen = async () => {
    try {
      console.log("🖥️ Starting screen share...")
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = screenStream.getVideoTracks()[0]

      // Notify others about screen sharing start
      if (socketRef.current) {
        socketRef.current.emit("start-screen-share", { roomId })
      }

      Object.values(peersRef.current).forEach((pc:any) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        if (sender) sender.replaceTrack(screenTrack)
      })

      screenTrack.onended = () => handleStopShare()
      setIsSharing(true)
    } catch (err) {
      console.error("❌ Screen share error", err)
    }
  }

  const setupVoiceDetection = (stream: MediaStream) => {
    console.log("Voice Detection  Triggered")
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      return () => {}
    }

    const audioContext = new AudioContextClass()
    const analyser = audioContext.createAnalyser()
    const microphone = audioContext.createMediaStreamSource(stream)

    analyser.fftSize = 512
    microphone.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    let speaking = false
    let lastEmitTime = 0
    let frameId = 0
    let stopped = false
    const EMIT_INTERVAL = 100 // Emit every 100ms

    const detect = () => {
      if (stopped) return
      analyser.getByteFrequencyData(dataArray)

      const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const threshold = 20
      const now = Date.now()
      const activeRoomId = roomIdRef.current

      if (volume > threshold && micOnRef.current) {
        if (activeRoomId && now - lastEmitTime > EMIT_INTERVAL) {
          socketRef.current?.emit("speaking-level", {
            roomId: activeRoomId,
            level: Math.round(volume),
          })
          lastEmitTime = now
        }
        if (!speaking) {
          speaking = true
        }
      } else if (speaking) {
        speaking = false
        if (activeRoomId) {
          socketRef.current?.emit("speaking-level", {
            roomId: activeRoomId,
            level: 0,
          })
        }
      }

      frameId = requestAnimationFrame(detect)
    }

    detect()

    return () => {
      stopped = true
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      try {
        microphone.disconnect()
        analyser.disconnect()
      } catch {}
      audioContext.close().catch(() => {})

      const activeRoomId = roomIdRef.current
      if (activeRoomId) {
        socketRef.current?.emit("speaking-level", {
          roomId: activeRoomId,
          level: 0,
        })
      }
    }
  }


  const handleStopShare = () => {
    console.log("🛑 Stopping screen share...")

    // Notify others about screen sharing stop
    if (socketRef.current) {
      socketRef.current.emit("stop-screen-share", { roomId })
    }

    const camTrack = getLocalStream().getVideoTracks()[0]
    Object.values(peersRef.current).forEach((pc:any) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video")
      if (sender) sender.replaceTrack(camTrack)
    })

    setIsSharing(false)
  }

  const handleVideoTileZoom = (participantId: string, isZoomed: boolean) => {
    if (isZoomed) {
      setZoomedParticipant(participantId)
    } else {
      setZoomedParticipant(null)
    }
  }

  const handleStudentAction = (action: string, targetUserId: string) => {
    console.log(user, "USer in handle Student Action")
    if (!isInstructor(user) || !socketRef.current) return
    console.log(`Instructor action: ${action} for user ${targetUserId}`)
    socketRef.current.emit("instructor-action", {
      roomId,
      action,
      targetUserId,
    })
  }

  const disconnectStudent = (targetUserId: string) => {
    handleStudentAction("disconnect", targetUserId)
  }

  const muteStudent = (targetUserId: string) => {
    handleStudentAction("mute", targetUserId)
  }

  const unmuteStudent = (targetUserId: string) => {
    handleStudentAction("unmute", targetUserId)
  }

  const stopStudentScreenShare = (targetUserId: string) => {
    handleStudentAction("stop-screen-share", targetUserId)
  }

  const toggleStudentVideo = (targetUserId: string, enable: boolean) => {
    handleStudentAction(enable ? "enable-video" : "disable-video", targetUserId)
  }

  const handleLeave = () => {
    console.log("👋 Leaving room:", roomId)
    setJoined(false)
    onLeave()
    if (socketRef.current) {
      socketRef.current.emit("leave", { roomId })
    }
  }

  const handleSendMessage = (message: string) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit("send-message", {
        roomId,
        message: message.trim(),
      })
    }
  }

  const toggleHandRaise = () => {
    if (socketRef.current) {
      if (isHandRaised) {
        socketRef.current.emit("lower-hand", { roomId })
      } else {
        socketRef.current.emit("raise-hand", { roomId })
      }
      setIsHandRaised(!isHandRaised)
    }
  }

  const toggleChatPanel = () => {
    const newState = !isChatOpen
    setIsChatOpen(newState)
    setIsParticipantsOpen(false)
  }

  const toggleParticipantsPanel = () => {
    const newState = !isParticipantsOpen
    setIsParticipantsOpen(newState)
    setIsChatOpen(false)
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const currentUserSpeakingLevel = participants.find((p) => p.id === user?.id)?.speakingLevel ?? 0

  if (showPreJoinModal) {
    return <TeamsPreJoinModal onConfirm={handlePreJoinConfirm} onCancel={handlePreJoinCancel} classData={classData} />
  }

  return (
    <div className="teams-container relative min-h-screen bg-[var(--color-background)] text-[var(--color-text)] overflow-hidden">
      {/* Premium Header */}
      <div className="fixed top-0 left-0 right-0 h-14 md:h-16 bg-[var(--color-surface-muted)] border-b border-[var(--color-border)] z-50">
        <div className="flex items-center justify-between h-full px-3 md:px-6">
          {/* Left: Class Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-[0_8px_20px_rgba(14,165,233,0.45)]">
                <VideoCameraIcon className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs md:text-sm font-semibold text-[var(--color-text)] truncate max-w-[9rem] md:max-w-xs">{classData?.name || "Live Class"}</span>
                <div className="flex items-center gap-1.5 md:gap-2">
                  {/* Live indicator */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-red-400">LIVE</span>
                  </div>
                  {/* Participant count */}
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-secondary)] text-xs text-[var(--color-text-secondary)]">
                    <UserGroupIcon className="w-3.5 h-3.5" />
                    <span>{participants.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)] flex items-center justify-center transition-all duration-200 hover:scale-105"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <ArrowsPointingOutIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
            </button>

            <button 
              className="hidden sm:flex w-9 h-9 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)] items-center justify-center transition-all duration-200 hover:scale-105" 
              title="Settings"
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-14 md:pt-16 pb-24 h-screen flex flex-col relative z-10 bg-[var(--color-background)]">
        {/* Video Area */}
        <div className="flex-1 min-h-0 relative flex px-1.5 sm:px-3 md:px-4 py-2 sm:py-3">
          <div className="absolute inset-1.5 sm:inset-3 md:inset-4 rounded-xl md:rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
          <div className="relative w-full h-full rounded-2xl overflow-hidden">
          <VideoGrid
            localStream={localStreamRef.current}
            peers={peers}
            participants={participants}
            user={user}
            isSharing={isSharing}
            screenSharingPeer={screenSharingPeer}
            zoomedParticipant={zoomedParticipant}
            onZoomToggle={handleVideoTileZoom}
            camOn={camOn}
            micOn={micOn}
            layoutMode={layoutMode}
          />
          </div>
          {/* // )} */}
        </div>

        {/* Chat Panel */}
        {isChatOpen && (
          <TeamsChatPanel messages={messages} onSendMessage={handleSendMessage} onClose={() => setIsChatOpen(false)} />
        )}

        {/* Participants Panel */}
        {isParticipantsOpen && (
          <TeamsParticipantsPanel
            participants={participants}
            user={user}
            onClose={() => setIsParticipantsOpen(false)}
            onMuteStudent={muteStudent}
            onUnmuteStudent={unmuteStudent}
            onDisconnectStudent={disconnectStudent}
          />
        )}

        {/* Premium Control Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-20 md:h-[88px] bg-[var(--color-surface-muted)] border-t border-[var(--color-border)] z-40">
          <div className="flex items-center justify-start md:justify-center h-full px-2 md:px-6 overflow-x-auto scrollbar-hide">
            {/* Floating Glass Pill Container */}
            <div className="inline-flex min-w-max items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 rounded-[24px] bg-[var(--color-surface)] border border-[var(--color-border)]">
              {/* Left Controls Group */}
              <div className="flex items-center gap-2">
                {/* Microphone */}
                <button
                  onClick={() => setMicOn(!micOn)}
                  className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    micOn 
                      ? "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]" 
                      : "bg-red-500 border-red-400/40 hover:bg-red-600 text-white shadow-[0_10px_22px_rgba(239,68,68,0.35)]"
                  }`}
                  title={micOn ? "Mute microphone" : "Unmute microphone"}
                >
                  {micOn ? (
                    <>
                      <MicrophoneIcon className="w-4 h-4 md:w-5 md:h-5" />
                      {/* Mic level animation when speaking */}
                      {currentUserSpeakingLevel > 20 && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-pulse-ring" />
                      )}
                    </>
                  ) : (
                    <MicrophoneIconSolid className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>

                {/* Camera */}
                <button
                  onClick={handleToggleCamera}
                  className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    camOn 
                      ? "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]" 
                      : "bg-red-500 border-red-400/40 hover:bg-red-600 text-white shadow-[0_10px_22px_rgba(239,68,68,0.35)]"
                  }`}
                  title={camOn ? "Turn off camera" : "Turn on camera"}
                >
                  {camOn ? <VideoCameraIcon className="w-4 h-4 md:w-5 md:h-5" /> : <VideoCameraSlashIcon className="w-4 h-4 md:w-5 md:h-5" />}
                </button>

                {/* Screen Share */}
                <button
                  onClick={isSharing ? handleStopShare : handleShareScreen}
                  className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isSharing 
                      ? "bg-emerald-500 border-emerald-400/40 text-white shadow-[0_10px_22px_rgba(16,185,129,0.35)]" 
                      : "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                  }`}
                  title={isSharing ? "Stop sharing" : "Share screen"}
                >
                  <ComputerDesktopIcon className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-7 md:h-8 bg-[var(--color-border)]" />

              {/* Center Controls Group */}
              <div className="flex items-center gap-2">
                {/* Hand Raise */}
                <button
                  onClick={toggleHandRaise}
                  className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isHandRaised 
                      ? "bg-amber-500 border-amber-400/40 text-white shadow-[0_10px_22px_rgba(245,158,11,0.35)]" 
                      : "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                  }`}
                  title={isHandRaised ? "Lower hand" : "Raise hand"}
                >
                  {isHandRaised ? <HandRaisedIconSolid className="w-4 h-4 md:w-5 md:h-5" /> : <HandRaisedIcon className="w-4 h-4 md:w-5 md:h-5" />}
                </button>

                {/* Chat */}
                <button
                  onClick={toggleChatPanel}
                  className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isChatOpen 
                      ? "bg-sky-500 border-sky-400/40 text-white shadow-[0_10px_22px_rgba(14,165,233,0.35)]" 
                      : "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                  }`}
                  title="Chat"
                >
                  <ChatBubbleLeftIcon className="w-4 h-4 md:w-5 md:h-5" />
                  {messages.length > 0 && !isChatOpen && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] md:text-xs rounded-full w-[18px] h-[18px] md:w-5 md:h-5 flex items-center justify-center font-semibold shadow-lg">
                      {messages.length > 9 ? "9+" : messages.length}
                    </div>
                  )}
                </button>

                {/* Participants */}
                <button
                  onClick={toggleParticipantsPanel}
                  className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isParticipantsOpen 
                      ? "bg-sky-500 border-sky-400/40 text-white shadow-[0_10px_22px_rgba(14,165,233,0.35)]" 
                      : "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                  }`}
                  title="Participants"
                >
                  <UserGroupIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <div className="absolute -top-1 -right-1 bg-accent-primary text-white text-[10px] md:text-xs rounded-full w-[18px] h-[18px] md:w-5 md:h-5 flex items-center justify-center font-semibold shadow-lg">
                    {participants.length}
                  </div>
                </button>

                {/* More Options */}
                <div>
                  <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 border ${
                      showMoreOptions 
                        ? "bg-sky-500 border-sky-400/40 text-white shadow-[0_10px_22px_rgba(14,165,233,0.35)]" 
                        : "bg-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                    }`}
                    title="More options"
                  >
                    <EllipsisHorizontalIcon className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-7 md:h-8 bg-[var(--color-border)]" />

              {/* Right: Leave Button */}
              <button
                onClick={handleLeave}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-red-400/[0.45] bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-[0_10px_24px_rgba(239,68,68,0.45)]"
                title="Leave call"
              >
                <PhoneIcon className="w-4 h-4 md:w-5 md:h-5 rotate-[135deg]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Teams Controls Bar */}
      {showMoreOptions && (
        <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--color-border)] py-2 min-w-64">
          <div className="px-4 pb-2 mb-1 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Layout</p>
            <div className="mt-1 space-y-1">
              <button
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                  layoutMode === "spotlight"
                    ? "bg-[var(--color-secondary-hover)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setLayoutMode("spotlight")
                  setShowMoreOptions(false)
                }}
              >
                Spotlight
              </button>
              <button
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                  layoutMode === "grid"
                    ? "bg-[var(--color-secondary-hover)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setLayoutMode("grid")
                  setShowMoreOptions(false)
                }}
              >
                Grid
              </button>
              <button
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                  layoutMode === "sidebar"
                    ? "bg-[var(--color-secondary-hover)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setLayoutMode("sidebar")
                  setShowMoreOptions(false)
                }}
              >
                Sidebar
              </button>
            </div>
          </div>
          <button className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-muted)] text-sm text-[var(--color-text)] flex items-center gap-3 transition-colors">
            <SpeakerWaveIcon className="w-4 h-4" />
            Speaker settings
          </button>
          <button className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-muted)] text-sm text-[var(--color-text)] flex items-center gap-3 transition-colors">
            <MicrophoneIcon className="w-4 h-4" />
            Microphone settings
          </button>
          <button className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-muted)] text-sm text-[var(--color-text)] flex items-center gap-3 transition-colors">
            <VideoCameraIcon className="w-4 h-4" />
            Camera settings
          </button>
        </div>
      )}

      {/* Click outside to close more options */}
      {showMoreOptions && <div className="fixed inset-0 z-10" onClick={() => setShowMoreOptions(false)} />}
    </div>
  )
}
