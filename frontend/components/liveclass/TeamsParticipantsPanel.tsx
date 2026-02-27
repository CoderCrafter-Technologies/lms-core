// components/TeamsParticipantsPanel.tsx
"use client"

import { XMarkIcon } from "@heroicons/react/24/outline"
import { MicrophoneIcon as MicrophoneIconSolid } from "@heroicons/react/24/solid"
import { isInstructor } from "@/lib/utils"
import type { Participant } from "@/types/liveClass"

interface TeamsParticipantsPanelProps {
  participants: Participant[]
  user: any
  onClose: () => void
  onMuteStudent?: (userId: string) => void
  onUnmuteStudent?: (userId: string) => void
  onDisconnectStudent?: (userId: string) => void
}

export default function TeamsParticipantsPanel({
  participants,
  user,
  onClose,
  onMuteStudent,
  onUnmuteStudent,
  onDisconnectStudent,
}: TeamsParticipantsPanelProps) {
  const isUserInstructor = isInstructor(user)

  const getParticipantInitials = (participant: Participant) => {
    return `${participant.firstName?.charAt(0) || ""}${participant.lastName?.charAt(0) || ""}`.toUpperCase()
  }

  // Microsoft Teams avatar colors
  const getTeamsAvatarColor = (name: string) => {
    const colors = [
      "bg-gradient-to-br from-blue-500 to-blue-600",
      "bg-gradient-to-br from-purple-500 to-purple-600",
      "bg-gradient-to-br from-green-500 to-green-600",
      "bg-gradient-to-br from-red-500 to-red-600",
      "bg-gradient-to-br from-yellow-500 to-yellow-600",
      "bg-gradient-to-br from-pink-500 to-pink-600",
      "bg-gradient-to-br from-indigo-500 to-indigo-600",
      "bg-gradient-to-br from-cyan-500 to-cyan-600",
    ]

    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  return (
    <div className="w-80 h-full bg-white flex flex-col border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Participants ({participants.length})</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close participants panel"
        >
          <XMarkIcon className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors mb-1"
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getTeamsAvatarColor(participant.name)}`}
            >
              {getParticipantInitials(participant)}
            </div>

            {/* Participant Info */}
            <div className="flex-1 min-w-0 ml-3">
              <div className="text-sm font-medium text-gray-900 truncate">
                {participant.name}
                {participant.id === user.id && <span className="text-gray-500 ml-1">(You)</span>}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                {participant.isSpeaking && (
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Speaking
                  </div>
                )}
                {participant.isHandRaised && (
                  <div className="flex items-center">
                    <span className="mr-1">✋</span>
                    Hand raised
                  </div>
                )}
                {participant.isScreenSharing && (
                  <div className="flex items-center">
                    <span className="mr-1">🖥️</span>
                    Presenting
                  </div>
                )}
                {!participant.camOn && (
                  <div className="flex items-center">
                    <span className="mr-1">📷</span>
                    Camera off
                  </div>
                )}
                {!participant.audioOn && (
                  <div className="flex items-center">
                    <span className="mr-1">🔇</span>
                    Muted
                  </div>
                )}
              </div>
            </div>

            {/* Actions for Instructor */}
            {isUserInstructor && participant.id !== user.id && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => participant.audioOn ? onMuteStudent?.(participant.id) : onUnmuteStudent?.(participant.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                  title={participant.audioOn ? "Mute participant" : "Unmute participant"}
                >
                  <MicrophoneIconSolid className={`w-3 h-3 ${!participant.audioOn ? 'text-red-500' : 'text-gray-600'}`} />
                </button>
                <button
                  onClick={() => onDisconnectStudent?.(participant.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                  title="Remove participant"
                >
                  <XMarkIcon className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          {participants.length} participant{participants.length !== 1 ? "s" : ""} in meeting
        </p>
      </div>
    </div>
  )
}