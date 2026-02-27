// components/TeamsVideoArea.tsx
"use client"

import VideoGrid from "../VideoGrid"
import type { Participant } from "@/types/liveClass"

interface TeamsVideoAreaProps {
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

export default function TeamsVideoArea({
  localStream,
  peers,
  participants,
  user,
  isSharing,
  screenSharingPeer,
  zoomedParticipant,
  onZoomToggle,
  camOn,
  micOn,
}: TeamsVideoAreaProps) {
  return (
    <div className="teams-video-area">
      <VideoGrid
        localStream={localStream}
        peers={peers}
        participants={participants}
        user={user}
        isSharing={isSharing}
        screenSharingPeer={screenSharingPeer}
        zoomedParticipant={zoomedParticipant}
        onZoomToggle={onZoomToggle}
        camOn={camOn}
        micOn={micOn}
      />
    </div>
  )
}