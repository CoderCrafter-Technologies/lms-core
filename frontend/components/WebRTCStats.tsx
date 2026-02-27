'use client'

import { useEffect, useState } from 'react'
import SimplePeer from 'simple-peer'

interface WebRTCStatsProps {
  peers: Map<string, SimplePeer.Instance>
  participants: Map<string, any>
  debugInfo: any
}

export default function WebRTCStats({ peers, participants, debugInfo }: WebRTCStatsProps) {
  const [stats, setStats] = useState<Array<{
    userId: string
    userName: string
    iceState: string
    signalingState: string
    hasRemoteStream: boolean
    connected: boolean
  }>>([])

  useEffect(() => {
    const updateStats = () => {
      const newStats: Array<{
        userId: string
        userName: string
        iceState: string
        signalingState: string
        hasRemoteStream: boolean
        connected: boolean
      }> = []

      peers.forEach((peer, userId) => {
        const participant = participants.get(userId)
        const peerInfo = debugInfo.peerConnections.get(userId) || {}
        
        newStats.push({
          userId,
          userName: participant ? `${participant.user.firstName} ${participant.user.lastName}` : 'Unknown',
          iceState: peerInfo.iceState || 'unknown',
          signalingState: peerInfo.signalingState || 'unknown',
          hasRemoteStream: peerInfo.hasRemoteStream || false,
          connected: peerInfo.connected || false
        })
      })

      setStats(newStats)
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    
    return () => clearInterval(interval)
  }, [peers, participants, debugInfo])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'completed':
        return 'text-green-500'
      case 'connecting':
      case 'checking':
        return 'text-yellow-500'
      case 'disconnected':
      case 'failed':
      case 'closed':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'completed':
        return '🟢'
      case 'connecting':
      case 'checking':
        return '🟡'
      case 'disconnected':
      case 'failed':
      case 'closed':
        return '🔴'
      default:
        return '⚪'
    }
  }

  if (stats.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-md">
        <h3 className="font-semibold text-orange-400 mb-2">WebRTC Connections</h3>
        <div className="text-sm text-gray-400">No active peer connections</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 p-4 rounded-md mb-4">
      <h3 className="font-semibold text-orange-400 mb-2">WebRTC Connections</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-gray-700 p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm">{stat.userName}</div>
              <div className={`text-xs ${getStatusColor(stat.iceState)}`}>
                {getStatusIcon(stat.iceState)} {stat.iceState}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Signaling:</div>
                <div>{stat.signalingState}</div>
              </div>
              
              <div>
                <div className="text-gray-400">Stream:</div>
                <div>{stat.hasRemoteStream ? '✅' : '❌'}</div>
              </div>
              
              <div>
                <div className="text-gray-400">Connected:</div>
                <div>{stat.connected ? '✅' : '❌'}</div>
              </div>
              
              <div>
                <div className="text-gray-400">User ID:</div>
                <div className="truncate" title={stat.userId}>
                  {stat.userId.substring(0, 8)}...
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}