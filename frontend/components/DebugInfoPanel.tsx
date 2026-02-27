'use client'

import { useState } from 'react'

interface DebugInfoPanelProps {
  debugInfo: any
  onClose: () => void
}

export default function DebugInfoPanel({ debugInfo, onClose }: DebugInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'peers' | 'media'>('events')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-11/12 h-5/6 max-w-6xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Debug Information</h2>
          <button 
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
          >
            Close
          </button>
        </div>
        
        <div className="flex border-b border-gray-700">
          <button
            className={`px-4 py-2 ${activeTab === 'events' ? 'bg-gray-700' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'peers' ? 'bg-gray-700' : ''}`}
            onClick={() => setActiveTab('peers')}
          >
            Peers
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'media' ? 'bg-gray-700' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'events' && (
            <div>
              <h3 className="font-semibold mb-2">Event Log</h3>
              <div className="h-96 overflow-y-auto text-sm">
                {debugInfo.events.slice().reverse().map((event: any, index: number) => (
                  <div key={index} className="border-b border-gray-700 py-2">
                    <div className="text-gray-400 text-xs">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="font-medium">{event.type}</div>
                    {event.data && (
                      <div className="text-gray-300 text-xs overflow-x-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'peers' && (
            <div>
              <h3 className="font-semibold mb-2">Peer Connections</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from(debugInfo.peerConnections.entries()).map(([userId, peerInfo]: [string, any]) => (
                  <div key={userId} className="bg-gray-700 p-3 rounded-md">
                    <div className="font-medium text-sm mb-2">User: {userId}</div>
                    <div className="text-xs space-y-1">
                      <div>Initiator: {peerInfo.initiator ? 'Yes' : 'No'}</div>
                      <div>Connected: {peerInfo.connected ? 'Yes' : 'No'}</div>
                      <div>Has Stream: {peerInfo.hasRemoteStream ? 'Yes' : 'No'}</div>
                      <div>ICE State: {peerInfo.iceState || 'unknown'}</div>
                      <div>Signaling State: {peerInfo.signalingState || 'unknown'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'media' && (
            <div>
              <h3 className="font-semibold mb-2">Media Status</h3>
              <div className="bg-gray-700 p-4 rounded-md">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Video</div>
                    <div>{debugInfo.mediaStatus.hasVideo ? '✅ Enabled' : '❌ Disabled'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Audio</div>
                    <div>{debugInfo.mediaStatus.hasAudio ? '✅ Enabled' : '❌ Disabled'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Screen Sharing</div>
                    <div>{debugInfo.mediaStatus.isScreenSharing ? '✅ Active' : '❌ Inactive'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Stream ID</div>
                    <div className="truncate" title={debugInfo.mediaStatus.streamId || 'N/A'}>
                      {debugInfo.mediaStatus.streamId || 'No stream'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}