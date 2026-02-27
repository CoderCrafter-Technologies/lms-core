// Controls.tsx
interface ControlsProps {
  micOn: boolean;
  setMicOn: (on: boolean) => void;
  camOn: boolean;
  setCamOn: (on: boolean) => void;
  isSharing: boolean;
  onShareScreen: () => void;
  onStopShare: () => void;
  onLeave: () => void;
  isHandRaised: boolean;
  onToggleHandRaise: () => void;
  canShareScreen?: boolean;
  isScreenShareRequested?: boolean;
}

export default function Controls({
  micOn,
  setMicOn,
  camOn,
  setCamOn,
  isSharing,
  onShareScreen,
  onStopShare,
  onLeave,
  isHandRaised,
  onToggleHandRaise,
  canShareScreen = true,
  isScreenShareRequested = false
}: ControlsProps) {

    
  return (
    <div className="flex items-center justify-center space-x-4">
      {/* Mic Control */}
      <button
        onClick={() => setMicOn(!micOn)}
        className={`p-3 rounded-full ${micOn ? 'bg-[#4A90E2] hover:bg-[#3A80D2]' : 'bg-red-500 hover:bg-red-600'} transition-colors`}
      >
        {micOn ? (
          <MicIcon className="w-6 h-6 text-white" />
        ) : (
          <MicOffIcon className="w-6 h-6 text-white" />
        )}
      </button>
      
      {/* Camera Control */}
      <button
        onClick={() => setCamOn(!camOn)}
        className={`p-3 rounded-full ${camOn ? 'bg-[#4A90E2] hover:bg-[#3A80D2]' : 'bg-red-500 hover:bg-red-600'} transition-colors`}
      >
        {camOn ? (
          <CameraIcon className="w-6 h-6 text-white" />
        ) : (
          <CameraOffIcon className="w-6 h-6 text-white" />
        )}
      </button>
      
      {/* Screen Share */}
      <button
        onClick={isSharing ? onStopShare : onShareScreen}
        className={`p-3 rounded-full ${isSharing ? 'bg-green-500 hover:bg-green-600' : 'bg-[#4A90E2] hover:bg-[#3A80D2]'} transition-colors`}
      >
        {isSharing ? (
          <StopShareIcon className="w-6 h-6 text-white" />
        ) : (
          <ShareIcon className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Hand Raise */}
      <button
        onClick={onToggleHandRaise}
        className={`p-3 rounded-full ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-[#4A90E2] hover:bg-[#3A80D2]'} transition-colors`}
      >
        <HandIcon className="w-6 h-6 text-white" />
      </button>
      
      {/* Leave Call */}
      <button
        onClick={onLeave}
        className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
      >
        <PhoneIcon className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

// Icon components
function MicIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2 2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CameraOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function StopShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function HandIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}