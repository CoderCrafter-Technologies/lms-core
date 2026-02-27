// components/TeamsPreJoinModal.tsx
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MicrophoneIcon, VideoCameraIcon } from "@heroicons/react/24/outline"
import { MicrophoneIcon as MicrophoneIconSolid, VideoCameraSlashIcon } from "@heroicons/react/24/solid"

interface TeamsPreJoinModalProps {
  onConfirm: (preferences: { micOn: boolean; camOn: boolean }) => void
  onCancel: () => void
  classData: any
}

export default function TeamsPreJoinModal({ onConfirm, onCancel, classData }: TeamsPreJoinModalProps) {
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const getPreviewStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setPreviewStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error("Error getting preview stream:", error)
      }
    }

    getPreviewStream()

    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleJoin = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop())
    }
    onConfirm({ micOn, camOn })
  }

  return (
    <div className="teams-modal-overlay">
      <div className="teams-modal max-w-lg">
        <div className="teams-modal-header">Join "{classData?.name || "Meeting"}"</div>

        <div className="teams-modal-content">
          {/* Video Preview */}
          <div className="relative mb-6">
            <video ref={videoRef} autoPlay muted playsInline className="teams-preview-video" />
            {!camOn && (
              <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-2 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {classData?.user?.firstName?.charAt(0) || "U"}
                  </div>
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}

            {/* Preview Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <button
                onClick={() => setCamOn(!camOn)}
                className={`teams-btn-icon ${!camOn ? "video-off" : ""}`}
                title={camOn ? "Turn off camera" : "Turn on camera"}
              >
                {camOn ? <VideoCameraIcon className="w-5 h-5" /> : <VideoCameraSlashIcon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setMicOn(!micOn)}
                className={`teams-btn-icon ${!micOn ? "muted" : ""}`}
                title={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                {micOn ? <MicrophoneIcon className="w-5 h-5" /> : <MicrophoneIconSolid className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="teams-toggle">
              <div className={`teams-switch ${micOn ? "active" : ""}`} onClick={() => setMicOn(!micOn)}>
                <div className="teams-switch-thumb"></div>
              </div>
              <span className="text-sm">Microphone</span>
            </div>

            <div className="teams-toggle">
              <div className={`teams-switch ${camOn ? "active" : ""}`} onClick={() => setCamOn(!camOn)}>
                <div className="teams-switch-thumb"></div>
              </div>
              <span className="text-sm">Camera</span>
            </div>
          </div>
        </div>

        <div className="teams-modal-actions">
          <button onClick={onCancel} className="teams-btn teams-btn-secondary">
            Cancel
          </button>
          <button onClick={handleJoin} className="teams-btn teams-btn-primary">
            Join now
          </button>
        </div>
      </div>
    </div>
  )
}