'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { 
  VideoCameraIcon, 
  VideoCameraSlashIcon,
  MicrophoneIcon, 
  MicrophoneMutedIcon,
  ChatBubbleLeftRightIcon,
  PresentationChartBarIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  UserMinusIcon,
  HandRaisedIcon,
  Cog6ToothIcon,
  PhoneXMarkIcon
} from '@heroicons/react/24/outline';

// Dynamic import to avoid SSR issues
const Whiteboard = dynamic(() => import('../../../components/classroom/Whiteboard'), { ssr: false });

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'instructor' | 'student';
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  avatar?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'instructor' | 'student';
  message: string;
  timestamp: Date;
  type: 'message' | 'system';
}

export default function ClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  // Socket and WebRTC refs
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // UI State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareRequested, setScreenShareRequested] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Permissions
  const [canScreenShare, setCanScreenShare] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);

  useEffect(() => {
    initializeClassroom();
    return () => {
      cleanup();
    };
  }, [roomId]);

  const initializeClassroom = async () => {
    try {
      // Get user info from localStorage or API
      const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
      const isInstructorRole = userInfo.role?.name === 'INSTRUCTOR';
      setIsInstructor(isInstructorRole);
      setCanScreenShare(isInstructorRole);
      
      // Initialize socket connection
      socketRef.current = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
        transports: ['websocket']
      });

      const socket = socketRef.current;

      // Socket event listeners
      socket.on('connect', () => {
        setIsConnected(true);
        joinRoom();
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('user-joined', (participant: Participant) => {
        setParticipants(prev => [...prev, participant]);
        addSystemMessage(`${participant.name} joined the class`);
      });

      socket.on('user-left', (participantId: string) => {
        setParticipants(prev => {
          const leftUser = prev.find(p => p.id === participantId);
          if (leftUser) {
            addSystemMessage(`${leftUser.name} left the class`);
          }
          return prev.filter(p => p.id !== participantId);
        });
      });

      socket.on('user-kicked', (data: { participantId: string; kickedBy: string }) => {
        if (data.participantId === socket.id) {
          toast.error('You have been removed from the class by the instructor.');
          router.push('/dashboard');
        }
      });

      socket.on('chat-message', (message: ChatMessage) => {
        setChatMessages(prev => [...prev, message]);
      });

      socket.on('screen-share-request', (data: { fromInstructor: boolean }) => {
        if (data.fromInstructor && !isInstructorRole) {
          setScreenShareRequested(true);
          setCanScreenShare(true);
        }
      });

      socket.on('screen-share-revoked', () => {
        if (!isInstructorRole) {
          setCanScreenShare(false);
          setScreenShareRequested(false);
          if (isScreenSharing) {
            stopScreenShare();
          }
        }
      });

      socket.on('participant-update', (updatedParticipant: Participant) => {
        setParticipants(prev => 
          prev.map(p => p.id === updatedParticipant.id ? updatedParticipant : p)
        );
      });

    } catch (error) {
      console.error('Failed to initialize classroom:', error);
    }
  };

  const joinRoom = () => {
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    
    const participantData: Participant = {
      id: socketRef.current?.id || '',
      name: `${userInfo.firstName || 'Unknown'} ${userInfo.lastName || 'User'}`,
      email: userInfo.email || '',
      role: userInfo.role?.name === 'INSTRUCTOR' ? 'instructor' : 'student',
      isAudioEnabled: false,
      isVideoEnabled: false,
      isScreenSharing: false,
      isHandRaised: false,
      avatar: userInfo.avatar
    };

    setCurrentUser(participantData);
    socketRef.current?.emit('join-room', { roomId, participant: participantData });
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    socketRef.current?.disconnect();
  };

  const toggleAudio = async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        socketRef.current?.emit('toggle-audio', { enabled: !isAudioEnabled });
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      }
      
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        
        if (localVideoRef.current && videoTrack.enabled) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        socketRef.current?.emit('toggle-video', { enabled: !isVideoEnabled });
      }
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (!canScreenShare) {
      toast.error('Screen sharing is not allowed yet. Wait for instructor permission.');
      return;
    }

    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStreamRef.current;
        screenShareRef.current.play();
      }

      setIsScreenSharing(true);
      socketRef.current?.emit('start-screen-share', {
        participantId: socketRef.current.id,
        participantName: currentUser?.name
      });

      // Handle screen share end
      screenStreamRef.current.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      console.log('Screen sharing started successfully');
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      const shareError = error as { name?: string };
      if (shareError.name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied. Please allow it to continue.');
      } else if (shareError.name === 'NotSupportedError') {
        toast.error('Screen sharing is not supported in this browser.');
      } else {
        toast.error('Failed to start screen sharing. Please try again.');
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (screenShareRef.current) {
      screenShareRef.current.srcObject = null;
    }

    setIsScreenSharing(false);
    socketRef.current?.emit('stop-screen-share');
  };

  const requestScreenShare = (participantId: string) => {
    socketRef.current?.emit('request-screen-share', { participantId });
  };

  const revokeScreenShare = (participantId: string) => {
    socketRef.current?.emit('revoke-screen-share', { participantId });
  };

  const kickParticipant = (participantId: string) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      socketRef.current?.emit('kick-participant', { participantId });
    }
  };

  const toggleHandRaise = () => {
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    socketRef.current?.emit('toggle-hand-raise', { raised: newHandRaised });
  };

  const sendMessage = () => {
    if (newMessage.trim() && currentUser) {
      const message: ChatMessage = {
        id: Date.now().toString(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        message: newMessage.trim(),
        timestamp: new Date(),
        type: 'message'
      };

      socketRef.current?.emit('send-message', message);
      setNewMessage('');
    }
  };

  const addSystemMessage = (text: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'system',
      senderName: 'System',
      senderRole: 'instructor',
      message: text,
      timestamp: new Date(),
      type: 'system'
    };
    setChatMessages(prev => [...prev, message]);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const leaveClass = () => {
    if (window.confirm('Are you sure you want to leave the class?')) {
      cleanup();
      router.push('/dashboard');
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-white font-semibold text-lg">Live Multi-User Test Session</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFullScreen}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullScreen ? (
              <ArrowsPointingInIcon className="w-5 h-5" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5" />
            )}
          </button>
          
          <button
            onClick={leaveClass}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Leave Class
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Video Grid */}
          <div className="flex-1 bg-gray-900 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
              {/* Screen Share Area */}
              {isScreenSharing && (
                <div className="col-span-full bg-black rounded-lg overflow-hidden">
                  <video
                    ref={screenShareRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              {/* Local Video */}
              <div className="bg-gray-800 rounded-lg overflow-hidden relative aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-white font-medium text-lg">
                          {currentUser?.name.charAt(0)}
                        </span>
                      </div>
                      <p className="text-white text-sm">{currentUser?.name} (You)</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  You {currentUser?.role === 'instructor' && '(Instructor)'}
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map(participant => (
                <div key={participant.id} className="bg-gray-800 rounded-lg overflow-hidden relative aspect-video group">
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-white font-medium text-lg">
                          {participant.name.charAt(0)}
                        </span>
                      </div>
                      <p className="text-white text-sm">{participant.name}</p>
                      {participant.role === 'instructor' && (
                        <p className="text-blue-400 text-xs">Instructor</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Participant Controls (for instructors) */}
                  {isInstructor && participant.role === 'student' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => requestScreenShare(participant.id)}
                          className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                          title="Request Screen Share"
                        >
                          <PresentationChartBarIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => kickParticipant(participant.id)}
                          className="p-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                          title="Remove Participant"
                        >
                          <UserMinusIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Audio/Video Indicators */}
                  <div className="absolute bottom-2 left-2 flex space-x-1">
                    {!participant.isAudioEnabled && (
                      <MicrophoneMutedIcon className="w-4 h-4 text-red-400" />
                    )}
                    {participant.isHandRaised && (
                      <HandRaisedIcon className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    {participant.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
            <div className="flex justify-center items-center space-x-4">
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${
                  isAudioEnabled
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={isAudioEnabled ? 'Mute' : 'Unmute'}
              >
                {isAudioEnabled ? (
                  <MicrophoneIcon className="w-5 h-5" />
                ) : (
                  <MicrophoneMutedIcon className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  isVideoEnabled
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? (
                  <VideoCameraIcon className="w-5 h-5" />
                ) : (
                  <VideoCameraSlashIcon className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-full transition-colors ${
                  canScreenShare
                    ? isScreenSharing
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
                title={canScreenShare ? (isScreenSharing ? 'Stop sharing' : 'Share screen') : 'Screen sharing not allowed'}
                disabled={!canScreenShare}
              >
                <PresentationChartBarIcon className="w-5 h-5" />
              </button>

              {!isInstructor && (
                <button
                  onClick={toggleHandRaise}
                  className={`p-3 rounded-full transition-colors ${
                    handRaised
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                  title={handRaised ? 'Lower hand' : 'Raise hand'}
                >
                  <HandRaisedIcon className="w-5 h-5" />
                </button>
              )}

              <div className="h-6 w-px bg-gray-600"></div>

              <button
                onClick={() => setShowWhiteboard(!showWhiteboard)}
                className={`p-3 rounded-full transition-colors ${
                  showWhiteboard
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
                title="Toggle Whiteboard"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-3 rounded-full transition-colors ${
                  showChat
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
                title="Toggle Chat"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </button>

              <button
                onClick={leaveClass}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="Leave Class"
              >
                <PhoneXMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Side Panels */}
        <div className="flex">
          {/* Participants Panel */}
          {showParticipants && (
            <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-white font-medium">
                  Participants ({participants.length + 1})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {/* Current User */}
                <div className="flex items-center p-2 text-white">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    {currentUser?.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{currentUser?.name} (You)</p>
                    <p className="text-xs text-gray-400 capitalize">{currentUser?.role}</p>
                  </div>
                </div>

                {/* Other Participants */}
                {participants.map(participant => (
                  <div key={participant.id} className="flex items-center p-2 text-white group">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      {participant.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{participant.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{participant.role}</p>
                    </div>
                    {participant.isHandRaised && (
                      <HandRaisedIcon className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Panel */}
          {showChat && (
            <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-white font-medium">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map(message => (
                  <div key={message.id} className={`${
                    message.type === 'system' ? 'text-center' : ''
                  }`}>
                    {message.type === 'system' ? (
                      <p className="text-gray-400 text-sm italic">{message.message}</p>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-medium ${
                            message.senderRole === 'instructor' ? 'text-blue-400' : 'text-gray-300'
                          }`}>
                            {message.senderName}
                            {message.senderRole === 'instructor' && ' (Instructor)'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-white text-sm">{message.message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-gray-700">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Whiteboard Modal */}
      {showWhiteboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Interactive Whiteboard</h2>
              <button
                onClick={() => setShowWhiteboard(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 p-4">
              <Whiteboard roomId={roomId} />
            </div>
          </div>
        </div>
      )}

      {/* Screen Share Request Notification */}
      {screenShareRequested && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <p className="text-sm">Instructor has allowed you to share your screen</p>
            <button
              onClick={() => setScreenShareRequested(false)}
              className="ml-4 text-white hover:text-gray-200"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
