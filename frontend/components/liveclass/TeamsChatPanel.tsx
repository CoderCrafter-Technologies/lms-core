// components/TeamsChatPanel.tsx
"use client"

import { useState, useEffect, RefObject } from "react"
import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ChatMessage } from "@/types/liveClass"

interface TeamsChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  onClose: () => void
  messagesEndRef?: RefObject<HTMLDivElement>
}

export default function TeamsChatPanel({ 
  messages, 
  onSendMessage, 
  onClose,
  messagesEndRef 
}: TeamsChatPanelProps) {
  const [newMessage, setNewMessage] = useState("")

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, messagesEndRef])

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage)
      setNewMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="teams-sidebar open">
      <div className="teams-panel-header flex items-center justify-between">
        <h3>Chat</h3>
        <button onClick={onClose} className="teams-btn-icon" style={{ width: "32px", height: "32px" }}>
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="teams-chat">
        <div className="teams-chat-messages">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Be the first to say hello!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="teams-chat-message teams-fade-in">
                <div className="teams-chat-message-header">
                  <span className="font-semibold">
                    {message.from?.firstName} {message.from?.lastName}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                </div>
                <div className="teams-chat-message-content text-sm mt-1">{message.message}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="teams-chat-input">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="teams-input flex-1"
            />
            <button 
              onClick={handleSend} 
              disabled={!newMessage.trim()} 
              className="teams-btn teams-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}