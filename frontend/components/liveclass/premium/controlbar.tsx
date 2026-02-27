// components/ControlBar.tsx
"use client"

import { motion } from "framer-motion"
import {
  MicrophoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  UserGroupIcon,
  HandRaisedIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline"
import {
  MicrophoneIcon as MicrophoneIconSolid,
  VideoCameraSlashIcon,
  HandRaisedIcon as HandRaisedIconSolid,
} from "@heroicons/react/24/solid"

interface ControlBarProps {
  micOn: boolean
  camOn: boolean
  isSharing: boolean
  isHandRaised: boolean
  isChatOpen: boolean
  isParticipantsOpen: boolean
  messagesCount: number
  participantsCount: number
  onMicToggle: () => void
  onCamToggle: () => void
  onScreenShareToggle: () => void
  onHandRaiseToggle: () => void
  onChatToggle: () => void
  onParticipantsToggle: () => void
  onMoreOptionsToggle: () => void
  onLeave: () => void
}

export default function ControlBar({
  micOn,
  camOn,
  isSharing,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  messagesCount,
  participantsCount,
  onMicToggle,
  onCamToggle,
  onScreenShareToggle,
  onHandRaiseToggle,
  onChatToggle,
  onParticipantsToggle,
  onMoreOptionsToggle,
  onLeave,
}: ControlBarProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 25 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface-2/80 backdrop-blur-premium shadow-premium-lg border border-white/10">
        {/* Left section */}
        <div className="flex items-center gap-1">
          <ControlButton
            icon={micOn ? MicrophoneIcon : MicrophoneIconSolid}
            active={!micOn}
            activeColor="bg-red-500/20 text-red-400"
            onClick={onMicToggle}
            tooltip={micOn ? "Mute" : "Unmute"}
          />
          <ControlButton
            icon={camOn ? VideoCameraIcon : VideoCameraSlashIcon}
            active={!camOn}
            activeColor="bg-red-500/20 text-red-400"
            onClick={onCamToggle}
            tooltip={camOn ? "Turn off camera" : "Turn on camera"}
          />
          <ControlButton
            icon={ComputerDesktopIcon}
            active={isSharing}
            activeColor="bg-green-500/20 text-green-400"
            onClick={onScreenShareToggle}
            tooltip={isSharing ? "Stop sharing" : "Share screen"}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Center section */}
        <div className="flex items-center gap-1">
          <ControlButton
            icon={isHandRaised ? HandRaisedIconSolid : HandRaisedIcon}
            active={isHandRaised}
            activeColor="bg-yellow-500/20 text-yellow-400"
            onClick={onHandRaiseToggle}
            tooltip={isHandRaised ? "Lower hand" : "Raise hand"}
          />
          <ControlButton
            icon={ChatBubbleLeftIcon}
            active={isChatOpen}
            activeColor="bg-purple-500/20 text-purple-400"
            onClick={onChatToggle}
            badge={messagesCount}
            tooltip="Chat"
          />
          <ControlButton
            icon={UserGroupIcon}
            active={isParticipantsOpen}
            activeColor="bg-purple-500/20 text-purple-400"
            onClick={onParticipantsToggle}
            badge={participantsCount > 1 ? participantsCount : undefined}
            tooltip="Participants"
          />
          <ControlButton
            icon={EllipsisHorizontalIcon}
            onClick={onMoreOptionsToggle}
            tooltip="More options"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Leave button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLeave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white font-medium hover:shadow-lg hover:shadow-red-500/25 transition-all"
        >
          <PhoneIcon className="w-5 h-5 rotate-[135deg]" />
          <span className="hidden sm:inline">Leave</span>
        </motion.button>
      </div>
    </motion.div>
  )
}

interface ControlButtonProps {
  icon: any
  active?: boolean
  activeColor?: string
  onClick: () => void
  badge?: number
  tooltip?: string
}

function ControlButton({ icon: Icon, active, activeColor, onClick, badge, tooltip }: ControlButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "relative p-3 rounded-xl transition-all",
        active 
          ? activeColor || "bg-purple-500/20 text-purple-400" 
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
      title={tooltip}
    >
      <Icon className="w-5 h-5" />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium flex items-center justify-center shadow-lg">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </motion.button>
  )
}