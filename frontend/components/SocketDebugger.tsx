'use client'

import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'

interface SocketDebuggerProps {
  socket: Socket | null
  roomId: string
}

interface SocketEvent {
  type: string
  timestamp: Date
  data: any
}

export default function SocketDebugger({ socket, roomId }: SocketDebuggerProps) {
  const [events, setEvents] = useState<SocketEvent[]>([])
  const [socketState, setSocketState] = useState<string>('disconnected')
  const [trafficStats, setTrafficStats] = useState({
    eventsReceived: 0,
    eventsSent: 0,
    lastEvent: null as string | null,
    lastEventTime: null as Date | null
  })

  useEffect(() => {
    if (!socket) return

    const handleConnect = () => {
      setSocketState('connected')
      addEvent('connect', { socketId: socket.id })
    }

    const handleDisconnect = () => {
      setSocketState('disconnected')
      addEvent('disconnect', {})
    }

    const handleError = (error: any) => {
      addEvent('error', { error })
    }

    const handleAnyEvent = (eventName: string, ...args: any[]) => {
      if (eventName === 'debug-info') return // Skip debug events to avoid infinite loop
      
      setTrafficStats(prev => ({
        ...prev,
        eventsReceived: prev.eventsReceived + 1,
        lastEvent: eventName,
        lastEventTime: new Date()
      }))

      addEvent(`received:${eventName}`, args[0] || {})
    }

    const addEvent = (type: string, data: any) => {
      const event = {
        type,
        timestamp: new Date(),
        data
      }
      
      setEvents(prev => {
        const newEvents = [...prev, event]
        // Keep only last 50 events
        return newEvents.slice(-50)
      })
    }

    // Listen to socket events
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('error', handleError)
    socket.onAny(handleAnyEvent)

    // Track outgoing events
    const originalEmit = socket.emit.bind(socket)
    socket.emit = (eventName: string, ...args: any[]) => {
      setTrafficStats(prev => ({
        ...prev,
        eventsSent: prev.eventsSent + 1,
        lastEvent: eventName,
        lastEventTime: new Date()
      }))

      addEvent(`sent:${eventName}`, args[0] || {})
      return originalEmit(eventName, ...args)
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('error', handleError)
      socket.offAny(handleAnyEvent)
    }
  }, [socket])

  const getSocketStateColor = () => {
    switch (socketState) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'disconnected': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getSocketStateIcon = () => {
    switch (socketState) {
      case 'connected': return '🟢'
      case 'connecting': return '🟡'
      case 'disconnected': return '🔴'
      default: return '⚪'
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 p-3 rounded-md">
          <h4 className="font-medium text-sm mb-2">Socket Connection</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={getSocketStateColor()}>
                {getSocketStateIcon()} {socketState}
              </span>
            </div>
            <div className="flex justify-between">
              <span>ID:</span>
              <span className="font-mono">{socket?.id || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Room:</span>
              <span className="truncate" title={roomId}>
                {roomId || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Connected:</span>
              <span>{socket?.connected ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-3 rounded-md">
          <h4 className="font-medium text-sm mb-2">Traffic Stats</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Events Received:</span>
              <span>{trafficStats.eventsReceived}</span>
            </div>
            <div className="flex justify-between">
              <span>Events Sent:</span>
              <span>{trafficStats.eventsSent}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Events:</span>
              <span>{trafficStats.eventsReceived + trafficStats.eventsSent}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Event:</span>
              <span className="truncate max-w-[120px]" title={trafficStats.lastEvent || ''}>
                {trafficStats.lastEvent || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Event Time:</span>
              <span>
                {trafficStats.lastEventTime 
                  ? trafficStats.lastEventTime.toLocaleTimeString() 
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-700 p-3 rounded-md">
        <h4 className="font-medium text-sm mb-2">Event Log</h4>
        <div className="h-40 overflow-y-auto text-xs">
          {events.length === 0 ? (
            <div className="text-gray-400 text-center py-4">No events yet</div>
          ) : (
            events.slice().reverse().map((event, index) => (
              <div key={index} className="border-b border-gray-600 py-1">
                <div className="flex justify-between text-gray-400">
                  <span>{event.timestamp.toLocaleTimeString()}</span>
                  <span className={
                    event.type.startsWith('sent:') ? 'text-blue-400' : 
                    event.type.startsWith('received:') ? 'text-green-400' : 
                    'text-gray-400'
                  }>
                    {event.type}
                  </span>
                </div>
                {event.data && Object.keys(event.data).length > 0 && (
                  <div className="text-gray-300 mt-1 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}