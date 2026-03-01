'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { io, Socket } from 'socket.io-client'
import { getSocketUrl } from '@/lib/services/socket'

export default function DebugSocketPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState('Disconnected')

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `${timestamp}: ${message}`
    console.log(logMessage)
    setLogs(prev => [...prev.slice(-20), logMessage])
  }

  useEffect(() => {
    const token = api.getToken()
    addLog(`🔑 Auth token available: ${!!token}`)

    addLog('🔌 Connecting to Socket.IO server...')
    const socketConnection = io(getSocketUrl(process.env.NEXT_PUBLIC_SOCKET_URL), {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    socketConnection.on('connect', () => {
      addLog(`✅ Connected with socket ID: ${socketConnection.id}`)
      setStatus('Connected')
      setSocket(socketConnection)
      
      if (token) {
        addLog('🔐 Attempting authentication...')
        socketConnection.emit('authenticate', { token })
      }
    })

    socketConnection.on('authenticated', (data) => {
      addLog(`✅ Authenticated successfully: ${JSON.stringify(data)}`)
      setStatus('Authenticated')
    })

    socketConnection.on('authentication-failed', (error) => {
      addLog(`❌ Authentication failed: ${error.message}`)
      setStatus('Auth Failed')
    })

    socketConnection.on('connect_error', (error) => {
      addLog(`🔴 Connection error: ${error.message}`)
      setStatus('Connection Failed')
    })

    socketConnection.on('disconnect', (reason) => {
      addLog(`🔌 Disconnected: ${reason}`)
      setStatus('Disconnected')
      setSocket(null)
    })

    socketConnection.on('error', (error) => {
      addLog(`🔴 Socket error: ${error}`)
    })

    return () => {
      addLog('🧹 Cleaning up connection...')
      socketConnection.disconnect()
    }
  }, [])

  const testJoinRoom = () => {
    if (socket) {
      const testRoomId = 'room_1755705632993_kyq01gxua'
      addLog(`🚪 Attempting to join room: ${testRoomId}`)
      
      socket.emit('join-class', {
        roomId: testRoomId,
        classId: 'test-class',
        user: { id: 'test', firstName: 'Test', lastName: 'User', roleId: { name: 'STUDENT' } }
      })

      socket.on('class-joined', (data) => {
        addLog(`🏠 Successfully joined class with ${data.participants?.length || 0} participants`)
      })

      socket.on('error', (error) => {
        addLog(`❌ Join error: ${error.message}`)
      })
    }
  }

  const testSendMessage = () => {
    if (socket) {
      const testMessage = 'Hello from debug page!'
      addLog(`💬 Sending message: ${testMessage}`)
      
      socket.emit('send-message', {
        roomId: 'room_1755705632993_kyq01gxua',
        message: testMessage
      })

      socket.on('chat-message', (data) => {
        addLog(`📨 Received message: ${data.from?.firstName}: ${data.message}`)
      })
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔧 Socket.IO Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <div className={`text-lg font-bold ${
            status === 'Authenticated' ? 'text-green-600' :
            status === 'Connected' ? 'text-blue-600' :
            status.includes('Failed') ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {status}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Test Actions</h2>
          <div className="space-x-2">
            <button
              onClick={testJoinRoom}
              disabled={!socket}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Test Join Room
            </button>
            <button
              onClick={testSendMessage}
              disabled={!socket}
              className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
            >
              Test Message
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 text-green-400 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-white">Debug Logs</h2>
        <div className="font-mono text-sm max-h-96 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-500">No logs yet...</div>
          )}
        </div>
      </div>
    </div>
  )
}
