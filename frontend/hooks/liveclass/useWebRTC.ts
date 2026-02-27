// hooks/useWebRTC.ts
import { useEffect, useRef, useState, useCallback } from "react"
import {
  initWebRTC,
  getLocalStream,
  createOrGetPeer,
  setRemoteDescriptionSafely,
  addIceCandidateSafely,
  removePeer,
} from "@/lib/services/webrtc"

interface UseWebRTCProps {
  roomId: string
  socket: any
  user: any
  participants: any[]
  onParticipantJoined: (participant: any) => void
  onParticipantLeft: (userId: string) => void
  onScreenShareStarted: (userId: string, socketId: string) => void
  onScreenShareStopped: (userId: string) => void
}

export function useWebRTC({
  roomId,
  socket,
  user,
  participants,
  onParticipantJoined,
  onParticipantLeft,
  onScreenShareStarted,
  onScreenShareStopped
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Record<string, { pc: RTCPeerConnection; stream: MediaStream }>>({})
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [isSharing, setIsSharing] = useState(false)
  const [screenSharingPeer, setScreenSharingPeer] = useState<string | null>(null)

  const peersRef = useRef<Record<string, RTCPeerConnection>>({})
  const localStreamRef = useRef<MediaStream | null>(null)
  const tracksAddedRef = useRef<Set<string>>(new Set())
  const videoSenderRef = useRef<Map<string, RTCRtpSender>>(new Map())
  const audioSenderRef = useRef<Map<string, RTCRtpSender>>(new Map()) // Track audio senders per peer

  // Initialize local stream
  useEffect(() => {
    const initStream = async () => {
      try {
        const stream = await initWebRTC()
        setLocalStream(stream)
        localStreamRef.current = stream
      } catch (error) {
        console.error("Failed to initialize WebRTC:", error)
      }
    }
    initStream()

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      Object.keys(peersRef.current).forEach(id => removePeer(id))
    }
  }, [])

  // Handle camera toggle
  useEffect(() => {
    if (!localStreamRef.current) return

    const videoTrack = localStreamRef.current.getVideoTracks()[0]
    
    if (videoTrack) {
      if (!camOn) {
        // Camera is off - remove video track from all peers
        Object.values(peersRef.current).forEach((pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video")
          if (sender) {
            try {
              pc.removeTrack(sender)
              console.log("Removed video track from peer")
            } catch (error) {
              console.error("Error removing video track:", error)
            }
          }
        })
      } else {
        // Camera is on - need to re-add video track
        // This requires renegotiation with all peers
        Object.entries(peersRef.current).forEach(([peerId, pc]) => {
          // Check if video track is already present
          const hasVideoSender = pc.getSenders().some(s => s.track?.kind === "video")
          
          if (!hasVideoSender && videoTrack) {
            try {
              const sender = pc.addTrack(videoTrack, localStreamRef.current!)
              videoSenderRef.current.set(peerId, sender)
              console.log(`Re-added video track to peer ${peerId}`)
              
              // Trigger renegotiation
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  if (socket) {
                    socket.emit("signal", { 
                      target: peerId, 
                      signal: { sdp: pc.localDescription } 
                    })
                  }
                })
                .catch(console.error)
            } catch (error) {
              console.error(`Error re-adding video track to peer ${peerId}:`, error)
            }
          }
        })
      }
      
      // Notify others about video state change
      if (socket && roomId) {
        socket.emit("video-toggle", { roomId, camOn })
      }
    }
  }, [camOn, socket, roomId])

  // Handle microphone toggle - FIXED VERSION
  useEffect(() => {
    if (!localStreamRef.current) return

    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    
    if (audioTrack) {
      if (!micOn) {
        // Microphone is off - remove audio track from all peers
        Object.values(peersRef.current).forEach((pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "audio")
          if (sender) {
            try {
              pc.removeTrack(sender)
              console.log("Removed audio track from peer")
            } catch (error) {
              console.error("Error removing audio track:", error)
            }
          }
        })
      } else {
        // Microphone is on - need to re-add audio track
        Object.entries(peersRef.current).forEach(([peerId, pc]) => {
          // Check if audio track is already present
          const hasAudioSender = pc.getSenders().some(s => s.track?.kind === "audio")
          
          if (!hasAudioSender && audioTrack) {
            try {
              const sender = pc.addTrack(audioTrack, localStreamRef.current!)
              audioSenderRef.current.set(peerId, sender)
              console.log(`Re-added audio track to peer ${peerId}`)
              
              // Trigger renegotiation
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  if (socket) {
                    socket.emit("signal", { 
                      target: peerId, 
                      signal: { sdp: pc.localDescription } 
                    })
                  }
                })
                .catch(console.error)
            } catch (error) {
              console.error(`Error re-adding audio track to peer ${peerId}:`, error)
            }
          }
        })
      }
      
      // Notify others about audio state change
      if (socket && roomId) {
        socket.emit("audio-toggle", { roomId, micOn })
      }
    }
  }, [micOn, socket, roomId])

  // Helper function to add tracks to peer connection safely
  const addTracksToPeer = useCallback((pc: RTCPeerConnection, peerId: string) => {
    if (!localStreamRef.current) return
    
    // Check if we've already added tracks for this peer
    if (tracksAddedRef.current.has(peerId)) {
      console.log(`Tracks already added for peer ${peerId}, skipping`)
      return
    }

    const existingSenders = pc.getSenders().map(s => s.track?.id).filter(Boolean)
    
    localStreamRef.current.getTracks().forEach(track => {
      // Check if this track is already being sent
      if (!existingSenders.includes(track.id)) {
        try {
          const sender = pc.addTrack(track, localStreamRef.current!)
          console.log(`Added track ${track.kind} to peer ${peerId}`)
          
          // Store sender for later use
          if (track.kind === 'video') {
            videoSenderRef.current.set(peerId, sender)
          } else if (track.kind === 'audio') {
            audioSenderRef.current.set(peerId, sender)
          }
        } catch (error) {
          console.error(`Error adding track to peer ${peerId}:`, error)
        }
      } else {
        console.log(`Track ${track.kind} already exists for peer ${peerId}`)
      }
    })
    
    tracksAddedRef.current.add(peerId)
  }, [])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !localStream) return

    const handleParticipantJoined = async ({ userId, user: peerUser, socketId }: any) => {
      if (!localStreamRef.current) return

      console.log(`Participant joined: ${userId} with socket ${socketId}`)

      const pc = createOrGetPeer(socketId, (remoteStream) => {
        console.log(`Received remote stream from ${socketId}`)
        setPeers(prev => ({ ...prev, [socketId]: { pc, stream: remoteStream } }))
        peersRef.current[socketId] = pc
      })

      peersRef.current[socketId] = pc

      // Add local tracks safely (only add tracks that are currently enabled)
      if (camOn) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        if (videoTrack) {
          try {
            const sender = pc.addTrack(videoTrack, localStreamRef.current!)
            videoSenderRef.current.set(socketId, sender)
          } catch (error) {
            console.error(`Error adding video track to peer ${socketId}:`, error)
          }
        }
      }
      
      if (micOn) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0]
        if (audioTrack) {
          try {
            const sender = pc.addTrack(audioTrack, localStreamRef.current!)
            audioSenderRef.current.set(socketId, sender)
          } catch (error) {
            console.error(`Error adding audio track to peer ${socketId}:`, error)
          }
        }
      }

      // Create and send offer
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit("signal", { target: socketId, signal: { sdp: pc.localDescription } })
        console.log(`Sent offer to ${socketId}`)
      } catch (error) {
        console.error(`Error creating offer for ${socketId}:`, error)
      }
    }

    const handleSignal = async ({ from, signal }: any) => {
      console.log(`Received signal from ${from}`)
      
      const pc = createOrGetPeer(from, (remoteStream) => {
        console.log(`Received remote stream from ${from}`)
        setPeers(prev => ({ ...prev, [from]: { pc, stream: remoteStream } }))
        peersRef.current[from] = pc
      })

      if (signal.sdp) {
        try {
          await setRemoteDescriptionSafely(from, signal.sdp)
          
          if (signal.sdp.type === "offer") {
            // Add tracks before answering (only add enabled tracks)
            if (camOn) {
              const videoTrack = localStreamRef.current?.getVideoTracks()[0]
              if (videoTrack) {
                try {
                  const sender = pc.addTrack(videoTrack, localStreamRef.current!)
                  videoSenderRef.current.set(from, sender)
                } catch (error) {
                  console.error(`Error adding video track to peer ${from}:`, error)
                }
              }
            }
            
            if (micOn) {
              const audioTrack = localStreamRef.current?.getAudioTracks()[0]
              if (audioTrack) {
                try {
                  const sender = pc.addTrack(audioTrack, localStreamRef.current!)
                  audioSenderRef.current.set(from, sender)
                } catch (error) {
                  console.error(`Error adding audio track to peer ${from}:`, error)
                }
              }
            }
            
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit("signal", { target: from, signal: { sdp: pc.localDescription } })
            console.log(`Sent answer to ${from}`)
          }
        } catch (error) {
          console.error(`Error handling signal from ${from}:`, error)
        }
      } else if (signal.candidate) {
        try {
          await addIceCandidateSafely(from, signal.candidate)
        } catch (error) {
          console.error(`Error adding ICE candidate from ${from}:`, error)
        }
      }
    }

    const handlePeerLeft = ({ peerId, userId }: any) => {
      console.log(`Peer left: ${peerId}, userId: ${userId}`)
      
      if (peersRef.current[peerId]) {
        removePeer(peerId)
        delete peersRef.current[peerId]
        videoSenderRef.current.delete(peerId)
        audioSenderRef.current.delete(peerId)
        setPeers(prev => {
          const copy = { ...prev }
          delete copy[peerId]
          return copy
        })
        tracksAddedRef.current.delete(peerId)
      }
      onParticipantLeft(userId)
    }

    const handleVideoToggle = ({ userId, camOn: remoteCamOn }: { userId: string; camOn: boolean }) => {
      console.log(`User ${userId} toggled camera to ${remoteCamOn}`)
      // This would need to update the participant in the parent component
    }

    const handleAudioToggle = ({ userId, micOn: remoteMicOn }: { userId: string; micOn: boolean }) => {
      console.log(`User ${userId} toggled audio to ${remoteMicOn}`)
      // This would need to update the participant in the parent component
    }

    socket.on("participant-joined", handleParticipantJoined)
    socket.on("signal", handleSignal)
    socket.on("peer-left", handlePeerLeft)
    socket.on("video-toggle", handleVideoToggle)
    socket.on("audio-toggle", handleAudioToggle)

    return () => {
      socket.off("participant-joined", handleParticipantJoined)
      socket.off("signal", handleSignal)
      socket.off("peer-left", handlePeerLeft)
      socket.off("video-toggle", handleVideoToggle)
      socket.off("audio-toggle", handleAudioToggle)
    }
  }, [socket, localStream, onParticipantLeft, camOn, micOn])

  const toggleScreenShare = useCallback(async () => {
    if (isSharing) {
      // Stop sharing - restore camera track
      const camTrack = localStreamRef.current?.getVideoTracks()[0]
      if (camTrack) {
        Object.values(peersRef.current).forEach((pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find((s: any) => s.track?.kind === "video")
          if (sender) {
            sender.replaceTrack(camTrack).catch(console.error)
          }
        })
      }
      setIsSharing(false)
      if (socket) {
        socket.emit("stop-screen-share", { roomId })
      }
    } else {
      // Start sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: false 
        })
        const screenTrack = screenStream.getVideoTracks()[0]

        // Replace video track in all peers with screen track
        Object.values(peersRef.current).forEach((pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find((s: any) => s.track?.kind === "video")
          if (sender) {
            sender.replaceTrack(screenTrack).catch(console.error)
          }
        })

        screenTrack.onended = () => {
          toggleScreenShare()
        }
        
        setIsSharing(true)
        if (socket) {
          socket.emit("start-screen-share", { roomId })
        }
      } catch (err) {
        console.error("Screen share error:", err)
      }
    }
  }, [isSharing, socket, roomId])

  const cleanupPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach(id => {
      removePeer(id)
      tracksAddedRef.current.delete(id)
      videoSenderRef.current.delete(id)
      audioSenderRef.current.delete(id)
    })
    peersRef.current = {}
    setPeers({})
  }, [])

  return {
    localStream,
    peers,
    isSharing,
    screenSharingPeer,
    micOn,
    camOn,
    setMicOn,
    setCamOn,
    toggleScreenShare,
    cleanupPeers,
    setScreenSharingPeer
  }
}