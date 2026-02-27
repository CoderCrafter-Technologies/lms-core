// components/VideoTile.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  HandRaisedIcon,
  MicrophoneIcon as MicrophoneIconSolid,
  VideoCameraSlashIcon,
} from "@heroicons/react/24/solid"

interface VideoTileProps {
  stream: MediaStream | null
  isLocal?: boolean
  user?: any
  isHandRaised?: boolean
  isSpeaking?: boolean
  isScreenSharing?: boolean
  onZoomToggle?: (isZoomed: boolean) => void
  isZoomed?: boolean
  className?: string
  camOn?: boolean
  audioOn?: boolean
  small?: boolean
  speakingLevel?: number
  videoFit?: "auto" | "contain" | "cover"
}

// Google Meet style avatar colors
const AVATAR_COLORS = [
  "bg-[#1a73e8]", // Blue
  "bg-[#d93025]", // Red
  "bg-[#1e8e3e]", // Green
  "bg-[#f9ab00]", // Yellow
  "bg-[#9334e6]", // Purple
  "bg-[#f65300]", // Orange
  "bg-[#188038]", // Dark Green
  "bg-[#a142f4]", // Light Purple
]

export default function VideoTile({
  stream,
  isLocal = false,
  user,
  isHandRaised = false,
  isSpeaking = false,
  isScreenSharing = false,
  onZoomToggle,
  isZoomed = false,
  className = "",
  camOn = true,
  audioOn = true,
  small = false,
  speakingLevel = 0,
  videoFit = "auto",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])

  // Set consistent avatar color based on user ID
  useEffect(() => {
    const index = (user?.id?.charCodeAt(0) || 0) % AVATAR_COLORS.length
    setAvatarColor(AVATAR_COLORS[index])
  }, [user?.id])

  // Video handling
  useEffect(() => {
    if (!videoRef.current || !stream) {
      setHasVideo(false)
      setIsVideoPlaying(false)
      return
    }

    const videoElement = videoRef.current
    videoElement.srcObject = stream

    const checkVideoTracks = () => {
      const videoTracks = stream.getVideoTracks()
      const hasActiveVideo =
        videoTracks.length > 0 &&
        videoTracks.some((track) => track.enabled && track.readyState === "live")
      setHasVideo(hasActiveVideo)
    }

    const playVideo = async () => {
      if (!camOn) {
        setIsVideoPlaying(false)
        return
      }
      try {
        await videoElement.play()
        setIsVideoPlaying(true)
      } catch {
        setIsVideoPlaying(false)
      }
    }

    checkVideoTracks()
    playVideo()

    const handleTrackEnded = () => checkVideoTracks()
    const handleTrackMuteChange = () => {
      checkVideoTracks()
      playVideo()
    }
    const handleVideoReady = () => {
      checkVideoTracks()
      playVideo()
    }

    videoElement.addEventListener("loadedmetadata", handleVideoReady)
    videoElement.addEventListener("canplay", handleVideoReady)

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", handleTrackEnded)
      track.addEventListener("mute", handleTrackMuteChange)
      track.addEventListener("unmute", handleTrackMuteChange)
    })

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleVideoReady)
      videoElement.removeEventListener("canplay", handleVideoReady)
      stream.getVideoTracks().forEach((track) => {
        track.removeEventListener("ended", handleTrackEnded)
        track.removeEventListener("mute", handleTrackMuteChange)
        track.removeEventListener("unmute", handleTrackMuteChange)
      })
      videoElement.srcObject = null
    }
  }, [stream, camOn])

  const getInitials = useCallback((userObj: any) => {
    if (!userObj) return "?"

    if (userObj.firstName && userObj.lastName) {
      return `${userObj.firstName[0]}${userObj.lastName[0]}`.toUpperCase()
    }

    if (userObj.name) {
      return userObj.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }

    if (userObj.email) {
      return userObj.email.slice(0, 2).toUpperCase()
    }

    return "?"
  }, [])

  const showAvatar = !camOn || !hasVideo || !isVideoPlaying
  const shouldContain = videoFit === "contain" || (videoFit === "auto" && (isScreenSharing || isZoomed))
  const displayName = isLocal ? "You" : user?.name || user?.email || "Guest"
  const showVideoOffIcon = !camOn
  const normalizedLevel = Math.max(0, Math.min(1, speakingLevel / 80))
  const isActivelySpeaking = isSpeaking || normalizedLevel > 0.08
  const glowStyle = isActivelySpeaking
    ? {
        border: `2px solid rgba(255,199,0,${(0.7 + normalizedLevel * 0.3).toFixed(2)})`,
        boxShadow: `0 0 0 1px rgba(255,199,0,${(0.6 + normalizedLevel * 0.3).toFixed(2)}), 0 0 24px rgba(255,199,0,${(0.2 + normalizedLevel * 0.35).toFixed(2)})`,
      }
    : { border: "2px solid transparent" }

  // Avatar size based on tile size - exactly like Google Meet
  const getAvatarSize = () => {
    if (small) return "w-10 h-10 text-base"
    if (isZoomed) return "w-32 h-32 text-4xl"
    return "w-20 h-20 text-2xl"
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#0f141d] group transition-shadow duration-150",
        {
          "cursor-pointer": onZoomToggle,
        },
        className
      )}
      style={glowStyle}
      onDoubleClick={() => onZoomToggle?.(!isZoomed)}
    >
      {/* Video */}
      {stream && camOn && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn("w-full h-full transition-opacity duration-300 bg-[#0f141d]", {
            "object-contain": shouldContain,
            "object-cover": !shouldContain,
            "opacity-0": showAvatar,
            "opacity-100": !showAvatar,
          })}
        />
      )}

      {/* Avatar - Google Meet style */}
      {showAvatar && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-white font-medium shadow-lg",
              avatarColor,
              getAvatarSize()
            )}
          >
            {getInitials(user)}
          </div>
        </div>
      )}

      {/* Hand raise indicator - Google Meet style */}
      {isHandRaised && (
        <div className="absolute top-2 left-2 z-10">
          <div className="w-8 h-8 rounded-full bg-amber-400/90 backdrop-blur-sm flex items-center justify-center shadow-lg border border-amber-200/40">
            <HandRaisedIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Mute indicator - Google Meet style */}
      {!audioOn && (
        <div className="absolute top-2 right-2 z-10">
          <div className="w-8 h-8 rounded-full bg-red-500/95 backdrop-blur-sm flex items-center justify-center shadow-lg border border-red-300/[0.35]">
            <MicrophoneIconSolid className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Name label - Google Meet style */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/[0.78] via-black/[0.45] to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-semibold tracking-wide truncate">{displayName}</span>

          {showVideoOffIcon && <VideoCameraSlashIcon className="w-4 h-4 text-white/90" />}
        </div>
      </div>

      {/* Speaking indicator - subtle like Google Meet */}
      {isActivelySpeaking && (
        <div className="absolute bottom-10 left-2 z-10">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-[#ffc700] rounded-full animate-pulse"
                style={{
                  height: `${8 + Math.round(normalizedLevel * (i === 1 ? 12 : 8))}px`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
