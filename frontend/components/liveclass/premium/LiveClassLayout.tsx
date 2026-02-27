// components/LiveClassLayout.tsx
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Header from "./Header"
import VideoGrid from "./VideoGrid"
import ControlBar from "./ControlBar"
import ChatPanel from "./ChatPanel"
import ParticipantsPanel from "./ParticipantsPanel"

interface LiveClassLayoutProps {
  classData: any
  user: any
  onLeave: () => void
  // ... other props
}

export default function LiveClassLayout({
  classData,
  user,
  onLeave,
  // ... other props
}: LiveClassLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [isRecording] = useState(false)
  const [duration] = useState("00:00")

  // Close panels when both are open? Actually we want them side by side
  // Let's handle layout when both panels are open

  return (
    <div className="relative h-screen w-full bg-background-primary overflow-hidden">
      {/* Header */}
      <Header
        className={classData?.name}
        participantCount={10}
        isRecording={isRecording}
        duration={duration}
      />

      {/* Main content area with dynamic padding */}
      <div 
        className="absolute inset-0"
        style={{
          paddingTop: '72px',
          paddingBottom: '88px',
          paddingLeft: isChatOpen ? '320px' : '0',
          paddingRight: isParticipantsOpen ? '320px' : '0',
          transition: 'padding 0.3s ease-in-out',
        }}
      >
        <VideoGrid
          // ... props
          camOn={true}
          micOn={true}
        />
      </div>

      {/* Panels */}
      <AnimatePresence>
        {isChatOpen && (
          <ChatPanel
            messages={[]}
            onSendMessage={() => {}}
            onClose={() => setIsChatOpen(false)}
            currentUser={user}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isParticipantsOpen && (
          <ParticipantsPanel
            participants={[]}
            user={user}
            onClose={() => setIsParticipantsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Control Bar */}
      <ControlBar
        micOn={true}
        camOn={true}
        isSharing={false}
        isHandRaised={false}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        messagesCount={5}
        participantsCount={10}
        onMicToggle={() => {}}
        onCamToggle={() => {}}
        onScreenShareToggle={() => {}}
        onHandRaiseToggle={() => {}}
        onChatToggle={() => setIsChatOpen(!isChatOpen)}
        onParticipantsToggle={() => setIsParticipantsOpen(!isParticipantsOpen)}
        onMoreOptionsToggle={() => {}}
        onLeave={onLeave}
      />
    </div>
  )
}