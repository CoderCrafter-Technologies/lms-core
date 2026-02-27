// hooks/useChat.ts
import { useState, useCallback, useRef, useEffect } from "react"
import { initSocket, releaseSocket } from "@/lib/services/socket"
import type { ChatMessage } from "@/types/liveClass"

interface UseChatProps {
  roomId: string
  user: any
}

export function useChat({ roomId, user }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({})
  const socketRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize socket connection
  useEffect(() => {
    if (!roomId) return

    const socket = process.env.NEXT_PUBLIC_SOCKET_URL 
      ? initSocket(process.env.NEXT_PUBLIC_SOCKET_URL) 
      : initSocket()
    
    socketRef.current = socket

    return () => {
      if (socketRef.current) {
        socketRef.current.off("chat-message")
        socketRef.current.off("typing-indicator")
      }
      releaseSocket()
    }
  }, [roomId])

  // Socket event listeners
  useEffect(() => {
    if (!socketRef.current || !roomId) return

    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => {
        // Check for duplicates
        if (prev.some(m => m.id === message.id)) return prev
        return [...prev, message]
      })
      setUnreadCount(prev => prev + 1)
      
      // Auto-scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }

    const handleTypingIndicator = ({ userId, isTyping: typing }: { userId: string; isTyping: boolean }) => {
      setIsTyping(prev => ({ ...prev, [userId]: typing }))
    }

    const handleChatHistory = (history: ChatMessage[]) => {
      setMessages(history || [])
    }

    socketRef.current.on("chat-message", handleChatMessage)
    socketRef.current.on("typing-indicator", handleTypingIndicator)
    socketRef.current.on("chat-history", handleChatHistory)

    return () => {
      socketRef.current?.off("chat-message", handleChatMessage)
      socketRef.current?.off("typing-indicator", handleTypingIndicator)
      socketRef.current?.off("chat-history", handleChatHistory)
    }
  }, [roomId])

  const sendMessage = useCallback((roomId: string, message: string) => {
    if (!socketRef.current || !message.trim() || !roomId) return

    const chatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      message: message.trim(),
      from: user,
      timestamp: new Date(),
      type: "text"
    }

    socketRef.current.emit("send-message", {
      roomId,
      message: chatMessage
    })

    // Optimistically add message to UI
    setMessages(prev => [...prev, chatMessage])
  }, [user])

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit("typing", { roomId, isTyping })
  }, [roomId])

  const clearChat = useCallback(() => {
    setMessages([])
    setUnreadCount(0)
  }, [])

  const markAsRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId))
    if (socketRef.current) {
      socketRef.current.emit("delete-message", { roomId, messageId })
    }
  }, [roomId])

  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => 
      prev.map(m => m.id === messageId ? { ...m, message: newContent, edited: true } : m)
    )
    if (socketRef.current) {
      socketRef.current.emit("edit-message", { roomId, messageId, content: newContent })
    }
  }, [roomId])

  return {
    socket: socketRef.current,
    messages,
    unreadCount,
    isTyping,
    messagesEndRef,
    sendMessage,
    sendTypingIndicator,
    clearChat,
    markAsRead,
    deleteMessage,
    editMessage
  }
}
