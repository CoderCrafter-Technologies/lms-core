// components/TeamsHeader.tsx
import { VideoCameraIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, Cog6ToothIcon } from "@heroicons/react/24/outline"

interface TeamsHeaderProps {
  className?: string
  participantCount: number
  onFullscreenToggle: () => void
  isFullscreen: boolean
}

export default function TeamsHeader({ className, participantCount, onFullscreenToggle, isFullscreen }: TeamsHeaderProps) {
  return (
    <div className="teams-header">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <VideoCameraIcon className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-gray-800 truncate">{className || "Live Class"}</span>
        </div>
        <div className="text-sm text-gray-500">
          • {participantCount} participant{participantCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onFullscreenToggle}
          className="teams-btn-icon"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
        </button>
        <button className="teams-btn-icon" title="Settings">
          <Cog6ToothIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}