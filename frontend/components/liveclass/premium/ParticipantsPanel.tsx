// components/ParticipantsPanel.tsx
"use client"

import { motion, AnimatePresence } from "framer-motion"
import { XMarkIcon, MicrophoneIcon, VideoCameraIcon } from "@heroicons/react/24/outline"
import { MicrophoneIcon as MicrophoneIconSolid, VideoCameraSlashIcon } from "@heroicons/react/24/solid"
import { isInstructor } from "@/lib/utils"
import type { Participant } from "@/types/liveClass"

interface ParticipantsPanelProps {
  participants: Participant[]
  user: any
  onClose: () => void
  onMuteStudent?: (userId: string) => void
  onDisconnectStudent?: (userId: string) => void
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-red-500',
  'from-green-500 to-emerald-500',
  'from-indigo-500 to-purple-500',
  'from-pink-500 to-rose-500',
]

export default function ParticipantsPanel({
  participants,
  user,
  onClose,
  onMuteStudent,
  onDisconnectStudent,
}: ParticipantsPanelProps) {
  const isUserInstructor = isInstructor(user)

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 25 }}
      className="absolute top-0 right-0 bottom-0 w-80 bg-surface-1/95 backdrop-blur-premium border-l border-white/10 shadow-2xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold">Participants ({participants.length})</h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <XMarkIcon className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto p-2">
        <AnimatePresence>
          {participants.map((participant, index) => {
            const isYou = participant.id === user.id
            const gradientIndex = (participant.id?.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length
            
            return (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-center p-3 rounded-xl hover:bg-white/5 transition-all"
              >
                {/* Avatar */}
                <div className={cn(
                  "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-medium shadow-lg",
                  AVATAR_GRADIENTS[gradientIndex]
                )}>
                  {participant.firstName?.[0]}{participant.lastName?.[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 ml-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {participant.name}
                      {isYou && <span className="text-white/40 ml-1">(You)</span>}
                    </span>
                    {participant.isSpeaking && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-2 h-2 bg-green-400 rounded-full"
                      />
                    )}
                  </div>
                  
                  {/* Status icons */}
                  <div className="flex items-center gap-2 mt-1">
                    {participant.isHandRaised && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <span>✋</span>
                        <span>Hand raised</span>
                      </span>
                    )}
                    {!participant.audioOn && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <MicrophoneIconSolid className="w-3 h-3" />
                        <span>Muted</span>
                      </span>
                    )}
                    {!participant.camOn && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <VideoCameraSlashIcon className="w-3 h-3" />
                        <span>Camera off</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isUserInstructor && !isYou && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => participant.audioOn ? onMuteStudent?.(participant.id) : null}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                    >
                      {participant.audioOn ? (
                        <MicrophoneIcon className="w-4 h-4" />
                      ) : (
                        <MicrophoneIconSolid className="w-4 h-4" />
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onDisconnectStudent?.(participant.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/40 text-center">
          {participants.length} participant{participants.length !== 1 ? 's' : ''} in meeting
        </div>
      </div>
    </motion.div>
  )
}