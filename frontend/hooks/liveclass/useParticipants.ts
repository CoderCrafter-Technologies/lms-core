// hooks/useParticipants.ts
import { useState, useCallback, useRef } from "react"
import type { Participant } from "@/types/liveClass"

interface UseParticipantsProps {
  user: any
}

export function useParticipants({ user }: UseParticipantsProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const participantsRef = useRef<Participant[]>([])

  // Keep ref in sync with state
  useState(() => {
    participantsRef.current = participants
  })

  const addParticipant = useCallback((participantData: any) => {
    setParticipants(prev => {
      // Check if participant already exists
      if (prev.some(p => p.id === participantData.id)) return prev
      
      const newParticipant: Participant = {
        id: participantData.id,
        socketId: participantData.socketId,
        name: participantData.name || `${participantData.firstName} ${participantData.lastName}`.trim(),
        firstName: participantData.firstName,
        lastName: participantData.lastName,
        isHandRaised: participantData.isHandRaised || false,
        isSpeaking: participantData.isSpeaking || false,
        isScreenSharing: participantData.isScreenSharing || false,
        camOn: participantData.camOn ?? true,
        audioOn: participantData.audioOn ?? true,
        user: participantData.user
      }
      
      return [...prev, newParticipant]
    })
  }, [])

  const removeParticipant = useCallback((userId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== userId && p.socketId !== userId))
  }, [])

  const updateParticipant = useCallback((userId: string, updates: Partial<Participant>) => {
    setParticipants(prev => 
      prev.map(p => p.id === userId || p.socketId === userId ? { ...p, ...updates } : p)
    )
  }, [])

  const updateParticipantMedia = useCallback((userId: string, mediaState: { camOn?: boolean; audioOn?: boolean }) => {
    setParticipants(prev => 
      prev.map(p => p.id === userId || p.socketId === userId ? { ...p, ...mediaState } : p)
    )
  }, [])

  const setParticipantSpeaking = useCallback((userId: string, isSpeaking: boolean) => {
    setParticipants(prev => 
      prev.map(p => p.id === userId || p.socketId === userId ? { ...p, isSpeaking } : p)
    )
  }, [])

  const getParticipantBySocketId = useCallback((socketId: string) => {
    return participantsRef.current.find(p => p.socketId === socketId)
  }, [])

  const getParticipantByUserId = useCallback((userId: string) => {
    return participantsRef.current.find(p => p.id === userId)
  }, [])

  return {
    participants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    updateParticipantMedia,
    setParticipantSpeaking,
    getParticipantBySocketId,
    getParticipantByUserId
  }
}
