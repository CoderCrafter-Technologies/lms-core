// types/liveClass.types.ts
export interface Participant {
  id: string
  socketId: string
  name: string
  firstName?: string
  lastName?: string
  isHandRaised: boolean
  isSpeaking?: boolean
  isScreenSharing?: boolean
  camOn?: boolean
  audioOn?: boolean
  user: any
}

export interface ChatMessage {
  id: string
  message: string
  from: any
  timestamp: Date
  type: string
}

export interface LiveClassRoomProps {
  classData: any
  user: any
  enrollmentId: string
  onLeave: () => void
}

export interface VideoGridProps {
  localStream: MediaStream | null
  peers: Record<string, { pc: RTCPeerConnection; stream: MediaStream }>
  participants: Participant[]
  user: any
  isSharing: boolean
  screenSharingPeer: string | null
  zoomedParticipant: string | null
  onZoomToggle: (participantId: string, isZoomed: boolean) => void
  camOn: boolean
  micOn: boolean
}