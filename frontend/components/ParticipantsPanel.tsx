import { useEffect, useState } from "react";
import { isInstructor, isStudent } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  isHandRaised: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  user: any; // Complete user object with role information
}

interface ParticipantsPanelProps {
  participants: Participant[];
  localUser: any;
  onMuteStudent?: (userId: string) => void;
  onUnmuteStudent?: (userId: string) => void;
  onToggleStudentVideo?: (userId: string, enable: boolean) => void;
  onDisconnectStudent?: (userId: string) => void;
  onClose?: () => void;
}

export default function ParticipantsPanel({ 
  participants, 
  localUser, 
  onMuteStudent,
  onUnmuteStudent,
  onToggleStudentVideo,
  onDisconnectStudent,
  onClose
}: ParticipantsPanelProps) {
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);
  
  useEffect(() => {
    console.log(participants, "Participants in ParticipantsPanel")
  }, [participants]);

  const isCurrentUserInstructor = isInstructor(localUser);
  
  const toggleParticipantExpansion = (participantId: string) => {
    if (expandedParticipant === participantId) {
      setExpandedParticipant(null);
    } else {
      setExpandedParticipant(participantId);
    }
  };

  const handleParticipantClick = (participant: Participant) => {
    const isCurrentUser = participant.id === localUser.id;
    const canControlParticipant = isCurrentUserInstructor && !isCurrentUser && !isInstructor(participant.user);
    
    if (canControlParticipant) {
      toggleParticipantExpansion(participant.id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
        {/* Header with close button for mobile */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">
          Participants ({participants.length})
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Close participants"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {participants.map((participant) => {
            const isCurrentUser = participant.id === localUser.id;
            const canControlParticipant = isCurrentUserInstructor && !isCurrentUser && !isInstructor(participant.user);
            const isExpanded = expandedParticipant === participant.id;
            
            return (
              <div 
                key={participant.id} 
                className={`p-3 bg-gray-800 rounded-xl transition-all duration-200 ${
                  canControlParticipant ? 'cursor-pointer hover:bg-gray-750' : ''
                } ${isExpanded ? 'border-2 border-blue-500 shadow-lg' : 'border border-gray-700'}`}
                onClick={() => handleParticipantClick(participant)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      participant.isScreenSharing ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 
                      participant.isSpeaking ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 
                      'bg-gradient-to-r from-gray-600 to-gray-700'
                    }`}>
                      {participant.name.charAt(0).toUpperCase()}
                      {participant.isSpeaking && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium flex items-center">
                        {participant.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">You</span>
                        )}
                        {isInstructor(participant.user) && (
                          <span className="ml-2 text-xs bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2 py-1 rounded-full">Instructor</span>
                        )}
                      </div>
                      <div className="flex space-x-2 text-xs mt-1">
                        {participant.isScreenSharing && (
                          <span className="text-emerald-400 flex items-center">
                            <ScreenShareIcon className="w-3 h-3 mr-1" />
                            Sharing
                          </span>
                        )}
                        {participant.isHandRaised && (
                          <span className="text-yellow-400 flex items-center">
                            <HandIcon className="w-3 h-3 mr-1" />
                            Raised
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Status badges */}
                    {participant.isScreenSharing && (
                      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center shadow">
                        <ScreenShareIcon className="w-3 h-3 mr-1" />
                        Screen
                      </div>
                    )}
                    {participant.isHandRaised && (
                      <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center shadow">
                        <HandIcon className="w-3 h-3 mr-1" />
                        Hand
                      </div>
                    )}
                    {canControlParticipant && (
                      <div className="text-gray-400 transform transition-transform duration-200">
                        {isExpanded ? (
                          <ChevronDownIcon className="w-5 h-5" />
                        ) : (
                          <ChevronRightIcon className="w-5 h-5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructor Controls - Only show when expanded */}
                {canControlParticipant && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMuteStudent && onMuteStudent(participant.id);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-200 shadow hover:shadow-md"
                        title="Mute student"
                      >
                        <MuteIcon className="w-4 h-4 mr-1" />
                        Mute
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnmuteStudent && onUnmuteStudent(participant.id);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-200 shadow hover:shadow-md"
                        title="Unmute student"
                      >
                        <UnmuteIcon className="w-4 h-4 mr-1" />
                        Unmute
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStudentVideo && onToggleStudentVideo(participant.id, false);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-200 shadow hover:shadow-md"
                        title="Turn off video"
                      >
                        <VideoOffIcon className="w-4 h-4 mr-1" />
                        Video Off
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStudentVideo && onToggleStudentVideo(participant.id, true);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-200 shadow hover:shadow-md"
                        title="Turn on video"
                      >
                        <VideoOnIcon className="w-4 h-4 mr-1" />
                        Video On
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDisconnectStudent && onDisconnectStudent(participant.id);
                        }}
                        className="col-span-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-200 shadow hover:shadow-md"
                        title="Disconnect student"
                      >
                        <DisconnectIcon className="w-4 h-4 mr-1" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Modern Icon components
function HandIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  );
}

function ScreenShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

function UnmuteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M12 6a7.975 7.975 0 014 1.07V5a3 3 0 10-6 0v6a3 3 0 004.535 2.536" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18a6 6 0 01-6-6v-2a1 1 0 011-1h10a1 1 0 011 1v2a6 6 0 01-6 6z" />
    </svg>
  );
}

function VideoOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 2l20 20" />
    </svg>
  );
}

function VideoOnIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function DisconnectIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}