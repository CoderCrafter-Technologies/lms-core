// components/TeamsControls.tsx
"use client"

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

interface TeamsControlsProps {
  micOn: boolean
  camOn: boolean
  isSharing: boolean
  isHandRaised: boolean
  isChatOpen: boolean
  isParticipantsOpen: boolean
  showMoreOptions: boolean
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

export default function TeamsControls({
  micOn,
  camOn,
  isSharing,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  showMoreOptions,
  messagesCount,
  participantsCount,
  onMicToggle,
  onCamToggle,
  onScreenShareToggle,
  onHandRaiseToggle,
  onChatToggle,
  onParticipantsToggle,
  onMoreOptionsToggle,
  onLeave
}: TeamsControlsProps) {
  return (
    <div className="teams-controls">
      <div className="flex items-center gap-2">
        <button
          onClick={onMicToggle}
          className={`teams-btn-icon ${!micOn ? "muted" : ""}`}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <MicrophoneIcon className="w-5 h-5" /> : <MicrophoneIconSolid className="w-5 h-5" />}
        </button>

        <button
          onClick={onCamToggle}
          className={`teams-btn-icon ${!camOn ? "video-off" : ""}`}
          title={camOn ? "Turn off camera" : "Turn on camera"}
        >
          {camOn ? <VideoCameraIcon className="w-5 h-5" /> : <VideoCameraSlashIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={onScreenShareToggle}
          className={`teams-btn-icon ${isSharing ? "active" : ""}`}
          title={isSharing ? "Stop sharing" : "Share screen"}
        >
          <ComputerDesktopIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onHandRaiseToggle}
          className={`teams-btn-icon ${isHandRaised ? "active" : ""}`}
          title={isHandRaised ? "Lower hand" : "Raise hand"}
        >
          {isHandRaised ? <HandRaisedIconSolid className="w-5 h-5" /> : <HandRaisedIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={onChatToggle}
          className={`teams-btn-icon relative ${isChatOpen ? "active" : ""}`}
          title="Chat"
        >
          <ChatBubbleLeftIcon className="w-5 h-5" />
          {messagesCount > 0 && !isChatOpen && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {messagesCount > 99 ? "99+" : messagesCount}
            </div>
          )}
        </button>

        <button
          onClick={onParticipantsToggle}
          className={`teams-btn-icon relative ${isParticipantsOpen ? "active" : ""}`}
          title="Participants"
        >
          <UserGroupIcon className="w-5 h-5" />
          {participantsCount > 1 && (
            <div className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {participantsCount}
            </div>
          )}
        </button>

        <div className="relative">
          <button
            onClick={onMoreOptionsToggle}
            className={`teams-btn-icon ${showMoreOptions ? "active" : ""}`}
            title="More options"
          >
            <EllipsisHorizontalIcon className="w-5 h-5" />
          </button>

          {showMoreOptions && (
            <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48">
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                <SpeakerWaveIcon className="w-4 h-4 inline mr-2" />
                Speaker settings
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                <MicrophoneIcon className="w-4 h-4 inline mr-2" />
                Microphone settings
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                <VideoCameraIcon className="w-4 h-4 inline mr-2" />
                Camera settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onLeave}
          className="teams-btn-danger flex items-center justify-center"
          title="Leave call"
        >
          <PhoneIcon className="w-5 h-5 rotate-[135deg]" />
        </button>
      </div>
    </div>
  )
}

// Add missing import
import { SpeakerWaveIcon } from "@heroicons/react/24/outline"