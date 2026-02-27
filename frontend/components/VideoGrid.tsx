// components/VideoGrid.tsx
"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import VideoTile from "@/components/VideoTile"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XMarkIcon,
  ArrowsPointingOutIcon
} from "@heroicons/react/24/outline"

interface VideoGridProps {
  localStream: MediaStream | null
  peers: Record<string, { pc: RTCPeerConnection; stream: MediaStream }>
  participants: any[]
  user: any
  isSharing: boolean
  screenSharingPeer: string | null
  zoomedParticipant: string | null
  onZoomToggle: (participantId: string, isZoomed: boolean) => void
  camOn: boolean
  micOn: boolean
  layoutMode?: "spotlight" | "grid" | "sidebar"
}

interface LayoutConfig {
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
}

export default function VideoGrid({
  localStream,
  peers,
  participants,
  user,
  isSharing,
  screenSharingPeer,
  zoomedParticipant,
  onZoomToggle,
  camOn,
  micOn,
  layoutMode = "grid",
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [filmstripIndex, setFilmstripIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [showFilmstripControls, setShowFilmstripControls] = useState(false)
  const [spotlightParticipantId, setSpotlightParticipantId] = useState<string | null>(null)

  // Get all participants with their streams
  const allParticipants = useMemo(() => {
    const selfParticipant = participants.find((p) => p.id === user?.id)
    const list = [
      {
        id: "local",
        stream: localStream,
        participant: {
          id: user?.id,
          user: user,
          isHandRaised: false,
          speakingLevel: selfParticipant?.speakingLevel ?? 0,
          isSpeaking: (selfParticipant?.speakingLevel ?? 0) > 20,
          isScreenSharing: isSharing,
          camOn,
          audioOn: micOn,
        },
        isLocal: true,
      },
      ...Object.entries(peers).map(([socketId, { stream }]) => {
        const participant = participants.find(p => p.socketId === socketId)
        return {
          id: socketId,
          stream,
          participant: participant ? {
            ...participant,
            speakingLevel: participant.speakingLevel ?? 0,
            isSpeaking: (participant.speakingLevel ?? 0) > 20,
            camOn: participant.camOn ?? true,
            audioOn: participant.audioOn ?? true,
          } : undefined,
          isLocal: false,
        }
      }),
    ].filter(item => item.stream || item.isLocal)
    return list
  }, [localStream, peers, participants, user, isSharing, camOn, micOn])

  const getLayoutConfig = useCallback(
    (count: number, containerWidth: number, containerHeight: number, gap: number): LayoutConfig => {
      if (count <= 0 || containerWidth <= 0 || containerHeight <= 0) {
        return { columns: 1, rows: 1, tileWidth: 0, tileHeight: 0 }
      }

      const aspect = 16 / 9
      let best: LayoutConfig = { columns: 1, rows: count, tileWidth: 0, tileHeight: 0 }
      let bestArea = 0

      for (let columns = 1; columns <= count; columns += 1) {
        const rows = Math.ceil(count / columns)
        const availableWidth = Math.max(containerWidth - gap * (columns - 1), 0)
        const availableHeight = Math.max(containerHeight - gap * (rows - 1), 0)

        const maxTileWidth = availableWidth / columns
        const maxTileHeight = availableHeight / rows
        const tileWidthByHeight = maxTileHeight * aspect

        const tileWidth = Math.min(maxTileWidth, tileWidthByHeight)
        const tileHeight = tileWidth / aspect
        const area = tileWidth * tileHeight

        if (area > bestArea) {
          bestArea = area
          best = { columns, rows, tileWidth, tileHeight }
        }
      }

      return best
    },
    []
  )

  // Update container size on resize
  useEffect(() => {
    if (!containerRef.current) return

    const node = containerRef.current
    const observer = new ResizeObserver(() => {
      setContainerSize({
        width: node.clientWidth,
        height: node.clientHeight,
      })
    })

    observer.observe(node)
    setContainerSize({
      width: node.clientWidth,
      height: node.clientHeight,
    })

    return () => observer.disconnect()
  }, [])

  const gap = containerSize.width < 640 ? 8 : containerSize.width < 1024 ? 12 : 16
  const gridPadding = containerSize.width < 640 ? 12 : 16
  const useSideRail = containerSize.width >= 1024
  const filmstripTileWidth = containerSize.width < 640 ? 140 : 180
  const filmstripMainPaddingClass = containerSize.width < 640 ? "absolute inset-0 p-2 pb-28" : "absolute inset-0 p-4 pb-32"
  const filmstripBarPaddingClass = containerSize.width < 640
    ? "absolute bottom-0 left-0 right-0 bg-[var(--color-surface-muted)] pt-5 pb-3 px-2"
    : "absolute bottom-0 left-0 right-0 bg-[var(--color-surface-muted)] pt-8 pb-4 px-4"
  const layout = getLayoutConfig(
    allParticipants.length,
    Math.max(containerSize.width - gridPadding * 2, 0),
    Math.max(containerSize.height - gridPadding * 2, 0),
    gap
  )

  useEffect(() => {
    setFilmstripIndex(0)
  }, [screenSharingPeer, zoomedParticipant])

  useEffect(() => {
    if (layoutMode !== "spotlight") return
    const remoteIds = allParticipants.filter((p) => !p.isLocal).map((p) => p.id)
    if (remoteIds.length === 0) {
      setSpotlightParticipantId(null)
      return
    }
    if (!spotlightParticipantId || !remoteIds.includes(spotlightParticipantId)) {
      setSpotlightParticipantId(remoteIds[0])
    }
  }, [layoutMode, allParticipants, spotlightParticipantId])

  // Screen sharing layout
  if (screenSharingPeer) {
    const screenSharer = allParticipants.find(p => p.id === screenSharingPeer)
    const otherParticipants = allParticipants.filter(p => p.id !== screenSharingPeer)
    const mainPaddingClass = useSideRail && otherParticipants.length > 0
      ? "absolute inset-0 p-4 pr-[236px]"
      : filmstripMainPaddingClass
    const itemsPerView = Math.max(1, Math.floor((containerSize.width - 100) / filmstripTileWidth))
    const maxStart = Math.max(otherParticipants.length - itemsPerView, 0)
    const startIndex = Math.min(filmstripIndex, maxStart)
    const visibleParticipants = otherParticipants.slice(startIndex, startIndex + itemsPerView)
    const canScrollPrev = startIndex > 0
    const canScrollNext = startIndex + itemsPerView < otherParticipants.length

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-full bg-[var(--color-surface-muted)]"
      >
        {/* Main screen share area */}
        <div className={mainPaddingClass}>
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)]">
            {screenSharer && (
              <VideoTile
                stream={screenSharer.stream}
                isLocal={screenSharer.isLocal}
                user={screenSharer.participant?.user}
                isHandRaised={screenSharer.participant?.isHandRaised}
                isSpeaking={screenSharer.participant?.isSpeaking}
                speakingLevel={screenSharer.participant?.speakingLevel ?? 0}
                isScreenSharing={true}
                onZoomToggle={(isZoomed) => onZoomToggle(screenSharer.id, isZoomed)}
                isZoomed={false}
                className="w-full h-full"
                camOn={screenSharer.participant?.camOn ?? true}
                audioOn={screenSharer.participant?.audioOn ?? true}
              />
            )}
          </div>
        </div>

        {/* Filmstrip */}
        {otherParticipants.length > 0 && !useSideRail && (
          <div className={filmstripBarPaddingClass}>
            <div className="relative max-w-7xl mx-auto">
              {/* Filmstrip navigation */}
              <AnimatePresence>
                {showFilmstripControls && canScrollPrev && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => setFilmstripIndex(prev => Math.max(0, prev - itemsPerView))}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-full p-2 shadow-xl border border-[var(--color-border)] transition-all hover:scale-110"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              <div
                ref={filmstripRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-2 sm:px-8"
                onMouseEnter={() => setShowFilmstripControls(true)}
                onMouseLeave={() => {
                  setShowFilmstripControls(false)
                  setIsDragging(false)
                }}
                onMouseDown={(e) => {
                  setIsDragging(true)
                  setDragStart(e.clientX)
                }}
                onMouseMove={(e) => {
                  if (!isDragging || !filmstripRef.current) return
                  e.preventDefault()
                  const delta = e.clientX - dragStart
                  filmstripRef.current.scrollLeft -= delta * 2
                  setDragStart(e.clientX)
                }}
                onMouseUp={() => setIsDragging(false)}
              >
                {visibleParticipants.map((participant) => (
                  <motion.div
                    key={participant.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="flex-shrink-0 w-36 h-20 sm:w-48 sm:h-28 rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-md cursor-pointer ring-1 ring-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-primary)] transition-all"
                    onClick={() => onZoomToggle(participant.id, true)}
                  >
                    <VideoTile
                      stream={participant.stream}
                      isLocal={participant.isLocal}
                      user={participant.participant?.user}
                      isHandRaised={participant.participant?.isHandRaised}
                      isSpeaking={participant.participant?.isSpeaking}
                      speakingLevel={participant.participant?.speakingLevel ?? 0}
                      isScreenSharing={participant.participant?.isScreenSharing}
                      onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                      isZoomed={false}
                      className="w-full h-full"
                      small={true}
                      camOn={participant.participant?.camOn ?? true}
                      audioOn={participant.participant?.audioOn ?? true}
                    />
                  </motion.div>
                ))}
              </div>

              <AnimatePresence>
                {showFilmstripControls && canScrollNext && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => setFilmstripIndex(prev => Math.min(maxStart, prev + itemsPerView))}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-full p-2 shadow-xl border border-[var(--color-border)] transition-all hover:scale-110"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        {otherParticipants.length > 0 && useSideRail && (
          <div className="absolute top-4 right-4 bottom-4 w-52 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              Participants ({otherParticipants.length})
            </div>
            <div className="p-2 space-y-2 overflow-y-auto h-full">
              {otherParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="w-full h-28 rounded-xl overflow-hidden bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-border)] cursor-pointer"
                  onClick={() => onZoomToggle(participant.id, true)}
                >
                  <VideoTile
                    stream={participant.stream}
                    isLocal={participant.isLocal}
                    user={participant.participant?.user}
                    isHandRaised={participant.participant?.isHandRaised}
                    isSpeaking={participant.participant?.isSpeaking}
                    speakingLevel={participant.participant?.speakingLevel ?? 0}
                    isScreenSharing={participant.participant?.isScreenSharing}
                    onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                    isZoomed={false}
                    className="w-full h-full"
                    small={true}
                    camOn={participant.participant?.camOn ?? true}
                    audioOn={participant.participant?.audioOn ?? true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  // Focus mode
  if (zoomedParticipant) {
    const zoomed = allParticipants.find(p => p.id === zoomedParticipant)
    const otherParticipants = allParticipants.filter(p => p.id !== zoomedParticipant)
    const mainPaddingClass = useSideRail && otherParticipants.length > 0
      ? "absolute inset-0 p-4 pr-[236px]"
      : filmstripMainPaddingClass
    const itemsPerView = Math.max(1, Math.floor((containerSize.width - 100) / filmstripTileWidth))
    const maxStart = Math.max(otherParticipants.length - itemsPerView, 0)
    const startIndex = Math.min(filmstripIndex, maxStart)
    const visibleParticipants = otherParticipants.slice(startIndex, startIndex + itemsPerView)
    const canScrollPrev = startIndex > 0
    const canScrollNext = startIndex + itemsPerView < otherParticipants.length

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-full bg-[var(--color-surface-muted)]"
      >
        {/* Exit focus button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onZoomToggle(zoomedParticipant, false)}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-full p-2 sm:p-2.5 shadow-xl border border-[var(--color-border)]"
        >
          <XMarkIcon className="w-5 h-5" />
        </motion.button>

        {/* Main zoomed view */}
        <div className={mainPaddingClass}>
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)]">
            {zoomed && (
              <VideoTile
                stream={zoomed.stream}
                isLocal={zoomed.isLocal}
                user={zoomed.participant?.user}
                isHandRaised={zoomed.participant?.isHandRaised}
                isSpeaking={zoomed.participant?.isSpeaking}
                speakingLevel={zoomed.participant?.speakingLevel ?? 0}
                isScreenSharing={zoomed.participant?.isScreenSharing}
                onZoomToggle={(isZoomed) => onZoomToggle(zoomed.id, isZoomed)}
                isZoomed={true}
                className="w-full h-full"
                camOn={zoomed.participant?.camOn ?? true}
                audioOn={zoomed.participant?.audioOn ?? true}
              />
            )}
          </div>
        </div>

        {/* Filmstrip */}
        {otherParticipants.length > 0 && !useSideRail && (
          <div className={filmstripBarPaddingClass}>
            <div className="relative max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Other participants - {otherParticipants.length}
                </span>
              </div>

              <AnimatePresence>
                {showFilmstripControls && canScrollPrev && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => setFilmstripIndex(prev => Math.max(0, prev - itemsPerView))}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-full p-2 shadow-xl border border-[var(--color-border)]"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              <div
                ref={filmstripRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-2 sm:px-8"
                onMouseEnter={() => setShowFilmstripControls(true)}
                onMouseLeave={() => setShowFilmstripControls(false)}
              >
                {visibleParticipants.map((participant) => (
                  <motion.div
                    key={participant.id}
                    whileHover={{ y: -4 }}
                    className="flex-shrink-0 w-36 h-20 sm:w-48 sm:h-28 rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-md cursor-pointer ring-1 ring-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-primary)] transition-all"
                    onClick={() => onZoomToggle(participant.id, true)}
                  >
                    <VideoTile
                      stream={participant.stream}
                      isLocal={participant.isLocal}
                      user={participant.participant?.user}
                      isHandRaised={participant.participant?.isHandRaised}
                      isSpeaking={participant.participant?.isSpeaking}
                      speakingLevel={participant.participant?.speakingLevel ?? 0}
                      isScreenSharing={participant.participant?.isScreenSharing}
                      onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                      isZoomed={false}
                      className="w-full h-full"
                      small={true}
                      camOn={participant.participant?.camOn ?? true}
                      audioOn={participant.participant?.audioOn ?? true}
                    />
                  </motion.div>
                ))}
              </div>

              <AnimatePresence>
                {showFilmstripControls && canScrollNext && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => setFilmstripIndex(prev => Math.min(maxStart, prev + itemsPerView))}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-full p-2 shadow-xl border border-[var(--color-border)]"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        {otherParticipants.length > 0 && useSideRail && (
          <div className="absolute top-4 right-4 bottom-4 w-52 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              Other participants ({otherParticipants.length})
            </div>
            <div className="p-2 space-y-2 overflow-y-auto h-full">
              {otherParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="w-full h-28 rounded-xl overflow-hidden bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-border)] cursor-pointer"
                  onClick={() => onZoomToggle(participant.id, true)}
                >
                  <VideoTile
                    stream={participant.stream}
                    isLocal={participant.isLocal}
                    user={participant.participant?.user}
                    isHandRaised={participant.participant?.isHandRaised}
                    isSpeaking={participant.participant?.isSpeaking}
                    speakingLevel={participant.participant?.speakingLevel ?? 0}
                    isScreenSharing={participant.participant?.isScreenSharing}
                    onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                    isZoomed={false}
                    className="w-full h-full"
                    small={true}
                    camOn={participant.participant?.camOn ?? true}
                    audioOn={participant.participant?.audioOn ?? true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  if (layoutMode === "spotlight") {
    const remoteParticipants = allParticipants.filter((p) => !p.isLocal)
    const localParticipant = allParticipants.find((p) => p.isLocal)
    const mainParticipant =
      remoteParticipants.find((p) => p.id === spotlightParticipantId) ?? remoteParticipants[0] ?? localParticipant
    const stripParticipants = remoteParticipants.filter((p) => p.id !== mainParticipant?.id)

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-full bg-[var(--color-surface-muted)] overflow-hidden"
      >
        <div className="absolute inset-0 p-2 sm:p-4 pb-24">
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] shadow-[var(--shadow-lg)]">
            {mainParticipant && (
              <VideoTile
                stream={mainParticipant.stream}
                isLocal={mainParticipant.isLocal}
                user={mainParticipant.participant?.user}
                isHandRaised={mainParticipant.participant?.isHandRaised}
                isSpeaking={mainParticipant.participant?.isSpeaking}
                speakingLevel={mainParticipant.participant?.speakingLevel ?? 0}
                isScreenSharing={mainParticipant.participant?.isScreenSharing}
                onZoomToggle={(isZoomed) => onZoomToggle(mainParticipant.id, isZoomed)}
                isZoomed={false}
                videoFit="contain"
                className="w-full h-full"
                camOn={mainParticipant.participant?.camOn ?? true}
                audioOn={mainParticipant.participant?.audioOn ?? true}
              />
            )}
          </div>
        </div>

        {stripParticipants.length > 0 && (
          <div className="absolute left-0 right-0 bottom-0 px-2 sm:px-4 pb-2 sm:pb-3">
            <div className="rounded-2xl bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2 py-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {stripParticipants.map((participant) => (
                  <button
                    key={participant.id}
                    onClick={() => setSpotlightParticipantId(participant.id)}
                    className="flex-shrink-0 w-28 h-16 sm:w-36 sm:h-20 rounded-lg overflow-hidden ring-1 ring-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-primary)]"
                  >
                    <VideoTile
                      stream={participant.stream}
                      isLocal={participant.isLocal}
                      user={participant.participant?.user}
                      isHandRaised={participant.participant?.isHandRaised}
                      isSpeaking={participant.participant?.isSpeaking}
                      speakingLevel={participant.participant?.speakingLevel ?? 0}
                      isScreenSharing={participant.participant?.isScreenSharing}
                      onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                      isZoomed={false}
                      className="w-full h-full"
                      small={true}
                      camOn={participant.participant?.camOn ?? true}
                      audioOn={participant.participant?.audioOn ?? true}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {localParticipant && mainParticipant?.id !== localParticipant.id && (
          <div className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 w-40 h-24 sm:w-48 sm:h-28 lg:w-56 lg:h-32 rounded-xl overflow-hidden ring-1 ring-[var(--color-border)] shadow-[var(--shadow-md)] bg-[var(--color-surface)]">
            <VideoTile
              stream={localParticipant.stream}
              isLocal={true}
              user={localParticipant.participant?.user}
              isHandRaised={localParticipant.participant?.isHandRaised}
              isSpeaking={localParticipant.participant?.isSpeaking}
              speakingLevel={localParticipant.participant?.speakingLevel ?? 0}
              isScreenSharing={localParticipant.participant?.isScreenSharing}
              onZoomToggle={(isZoomed) => onZoomToggle(localParticipant.id, isZoomed)}
              isZoomed={false}
              className="w-full h-full"
              small={true}
              videoFit="contain"
              camOn={localParticipant.participant?.camOn ?? true}
              audioOn={localParticipant.participant?.audioOn ?? true}
            />
          </div>
        )}
      </motion.div>
    )
  }

  if (layoutMode === "sidebar" && containerSize.width >= 1024) {
    const mainParticipant = allParticipants[0]
    const railParticipants = allParticipants.slice(1)

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-full bg-[var(--color-surface-muted)] overflow-hidden"
      >
        <div className="absolute inset-0 p-3 sm:p-4 pr-[220px]">
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] shadow-[var(--shadow-lg)]">
            {mainParticipant && (
              <VideoTile
                stream={mainParticipant.stream}
                isLocal={mainParticipant.isLocal}
                user={mainParticipant.participant?.user}
                isHandRaised={mainParticipant.participant?.isHandRaised}
                isSpeaking={mainParticipant.participant?.isSpeaking}
                speakingLevel={mainParticipant.participant?.speakingLevel ?? 0}
                isScreenSharing={mainParticipant.participant?.isScreenSharing}
                onZoomToggle={(isZoomed) => onZoomToggle(mainParticipant.id, isZoomed)}
                isZoomed={false}
                videoFit="contain"
                className="w-full h-full"
                camOn={mainParticipant.participant?.camOn ?? true}
                audioOn={mainParticipant.participant?.audioOn ?? true}
              />
            )}
          </div>
        </div>
        <div className="absolute top-3 right-3 bottom-3 w-[204px] rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-2 overflow-y-auto">
          <div className="space-y-2">
            {railParticipants.map((participant) => (
              <div
                key={participant.id}
                className="w-full h-28 rounded-xl overflow-hidden ring-1 ring-[var(--color-border)] cursor-pointer"
                onClick={() => onZoomToggle(participant.id, true)}
              >
                <VideoTile
                  stream={participant.stream}
                  isLocal={participant.isLocal}
                  user={participant.participant?.user}
                  isHandRaised={participant.participant?.isHandRaised}
                  isSpeaking={participant.participant?.isSpeaking}
                  speakingLevel={participant.participant?.speakingLevel ?? 0}
                  isScreenSharing={participant.participant?.isScreenSharing}
                  onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                  isZoomed={false}
                  videoFit="contain"
                  className="w-full h-full"
                  small={true}
                  camOn={participant.participant?.camOn ?? true}
                  audioOn={participant.participant?.audioOn ?? true}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  // Grid layout
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full bg-[var(--color-surface-muted)] overflow-hidden"
    >
      <div
        className="w-full h-full flex items-center justify-center relative z-10"
        style={{ padding: `${gridPadding}px` }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="grid place-content-center"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, ${Math.floor(layout.tileWidth)}px)`,
              gridAutoRows: `${Math.floor(layout.tileHeight)}px`,
              gap: `${gap}px`,
            }}
          >
            <AnimatePresence>
              {allParticipants.map((participant, index) => (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ 
                    delay: index * 0.03,
                    type: "spring",
                    damping: 25,
                  }}
                  className="relative group"
                  style={{
                    width: `${Math.floor(layout.tileWidth)}px`,
                    height: `${Math.floor(layout.tileHeight)}px`,
                  }}
                >
                  <div className="absolute inset-0 rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-[var(--color-primary)] hover:scale-[1.01] hover:z-10">
                    <VideoTile
                      stream={participant.stream}
                      isLocal={participant.isLocal}
                      user={participant.participant?.user}
                      isHandRaised={participant.participant?.isHandRaised}
                      isSpeaking={participant.participant?.isSpeaking}
                      speakingLevel={participant.participant?.speakingLevel ?? 0}
                      isScreenSharing={participant.participant?.isScreenSharing}
                      onZoomToggle={(isZoomed) => onZoomToggle(participant.id, isZoomed)}
                      isZoomed={false}
                      className="w-full h-full"
                      camOn={participant.participant?.camOn ?? true}
                      audioOn={participant.participant?.audioOn ?? true}
                    />
                    
                    {/* Quick focus button */}
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onZoomToggle(participant.id, true)}
                      className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-text)] rounded-lg p-1.5 shadow-lg border border-[var(--color-border)]"
                    >
                      <ArrowsPointingOutIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
