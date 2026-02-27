// components/live-classroom/LiveClassRoomV2.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'

// UI Components
import { Button } from '@/components/ui/button'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  MessageSquare,
  Monitor,
  Users,
  Settings,
  Share2,
  Hand,
  ScreenShare,
  ScreenShareOff,
  Clipboard,
  Bell,
  MoreVertical,
  Grid,
  Maximize,
  Minimize,
  Bug,
  RefreshCw
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types
interface Participant {
  userId: string
  user: any
  stream?: MediaStream
  isHandRaised?: boolean
  connectionStats?: {
    iceState: string
    signalingState: string
    connectionState: string
    hasRelayCandidate: boolean
  }
}

interface ChatMessage {
  id: string
  message: string
  from: any
  timestamp: Date
  type: 'text' | 'system' | 'poll'
}

interface Poll {
  id: string
  question: string
  options: string[]
  votes: Record<string, string>
  createdBy: string
  createdAt: Date
}

interface ConnectionStats {
  iceState: string
  signalingState: string
  connectionState: string
  hasRelayCandidate: boolean
}

interface DebugInfo {
  events: Array<{ timestamp: Date; type: string; data: any }>
  peerConnections: Map<string, any>
  mediaStatus: {
    hasVideo: boolean
    hasAudio: boolean
    isScreenSharing: boolean
    streamId?: string
  }
  connectionQuality: string
}

// WebRTC Configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    {
      urls: "turn:relay1.expressturn.com:3478",
      username: "efO8XQ995C6NTR8XA7",
      credential: "q4zPrbAEwJJH4720",
    },
  ],
};

interface LiveClassRoomProps {
  classData: any
  user: any
  enrollmentId: string
  onLeave: () => void
}

export default function LiveClassRoom({ classData, user, enrollmentId, onLeave }: LiveClassRoomProps) {
  // State management
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    events: [],
    peerConnections: new Map(),
    mediaStatus: {
      hasVideo: false,
      hasAudio: false,
      isScreenSharing: false
    },
    connectionQuality: 'unknown'
  })
  
  const [socket, setSocket] = useState<Socket | null>(null)
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map())
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'polls'>('chat')
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [currentPoll, setCurrentPoll] = useState<Poll | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'average' | 'poor'>('good')
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    iceState: '',
    signalingState: '',
    connectionState: '',
    hasRelayCandidate: false
  });
  const [isInstructor, setIsInstructor] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const classroomRef = useRef<HTMLDivElement>(null)
  const isMediaInitializedRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const hasJoinedRef = useRef(false)
  const mountCountRef = useRef(0)
  const debugLogRef = useRef<Array<{ timestamp: Date; type: string; data: any }>>([]);
  
  // WebRTC peer management
  const peersMapRef = useRef<Record<string, {
    pc: RTCPeerConnection;
    queuedCandidates: RTCIceCandidateInit[];
    onTrack?: (stream: MediaStream) => void;
    iceCheckingStartTime?: number;
  }>>({});

  // Custom logger function
  const debugLog = useCallback((message: string, data?: any) => {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}] ${message}`, data || '');
    
    // Add to debug log
    const entry = { timestamp: new Date(), type: message, data }
    debugLogRef.current.push(entry)
    
    // Keep only last 100 entries
    if (debugLogRef.current.length > 100) {
      debugLogRef.current = debugLogRef.current.slice(-100)
    }
    
    setDebugInfo(prev => ({
      ...prev,
      events: [...debugLogRef.current]
    }))
  }, []);

  // Initialize component
  useEffect(() => {
    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search)
    const debugParam = urlParams.get('debug')
    const shouldDebug = debugParam === 'true' || debugParam === 'webrtc'
    setDebugMode(shouldDebug)
    
    if (shouldDebug) {
      debugLog('Debug mode enabled', { param: debugParam })
    }

    mountCountRef.current += 1
    if (mountCountRef.current === 1) {
      debugLog('Component mounted', { classData, user })
    } else {
      debugLog('Component remounted', { count: mountCountRef.current })
    }

    // Check if user is instructor
    const instructorRole = user?.roleId?.name === 'INSTRUCTOR' || user?.role === 'instructor'
    setIsInstructor(instructorRole)
    debugLog('User role determined', { isInstructor: instructorRole })

    // Validate class data has required roomId
    if (classData && !classData.roomId) {
      debugLog('Missing roomId in classData', { classData })
      const fallbackRoomId = `room_${classData.id || classData._id || Date.now()}`
      classData.roomId = fallbackRoomId
      debugLog('Using fallback roomId', { roomId: fallbackRoomId })
    }
  }, [classData, user, debugLog])

  // Initialize media stream
  useEffect(() => {
    let mounted = true
    
    const initializeMedia = async () => {
      if (isMediaInitializedRef.current) {
        debugLog('Media already initialized', {})
        return
      }

      try {
        debugLog('Requesting user media', {})
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        debugLog('Media obtained', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamId: stream.id
        })

        localStreamRef.current = stream
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          debugLog('Video element configured', {})
        }

        isMediaInitializedRef.current = true
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          mediaStatus: {
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
            isScreenSharing: false,
            streamId: stream.id
          }
        }))

        debugLog('Media initialization complete', {})

        // Join room if socket is ready
        if (socketRef.current?.connected && !hasJoinedRef.current) {
          debugLog('Media ready, joining room', {})
          joinClassRoom()
        }

      } catch (error) {
        debugLog('Media error', { error: error.message })
        
        // Try with audio only
        try {
          debugLog('Trying audio-only fallback', {})
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          
          if (!mounted) {
            audioStream.getTracks().forEach(track => track.stop())
            return
          }
          
          localStreamRef.current = audioStream
          isMediaInitializedRef.current = true
          
          // Update debug info
          setDebugInfo(prev => ({
            ...prev,
            mediaStatus: {
              hasVideo: false,
              hasAudio: true,
              isScreenSharing: false,
              streamId: audioStream.id
            }
          }))

          debugLog('Audio-only obtained', {})

          // Join room if socket is ready
          if (socketRef.current?.connected && !hasJoinedRef.current) {
            debugLog('Audio ready, joining room', {})
            joinClassRoom()
          }
        } catch (audioError) {
          debugLog('Audio fallback error', { error: audioError.message })
        }
      }
    }

    initializeMedia()

    return () => {
      mounted = false
      debugLog('Media cleanup', {})
    }
  }, [debugLog])

  // Initialize socket connection
  useEffect(() => {
    let mounted = true
    
    const token = api.getToken()
    if (!token) {
      debugLog('No auth token found', {})
      return
    }

    if (socketRef.current?.connected) {
      debugLog('Socket already connected', {})
      return
    }

    debugLog('Initializing socket connection', {})
    const socketConnection = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'https://api.lms.codercrafter.in', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      auth: { token }
    })

    socketRef.current = socketConnection

    socketConnection.on('connect', () => {
      if (!mounted) return
      
      debugLog('Socket connected', { socketId: socketConnection.id })
      setSocketState('connected')
      
      // Authenticate first
      debugLog('Authenticating socket', {})
      socketConnection.emit('authenticate', { token })
    })

    socketConnection.on('authenticated', (data) => {
      if (!mounted) return
      
      if (data.success) {
        debugLog('Authentication successful', { user: data.user })
        setSocket(socketConnection)
        
        // Join room if media is ready
        if (isMediaInitializedRef.current && !hasJoinedRef.current) {
          debugLog('Socket and media ready, joining room', {})
          joinClassRoom()
        }
      }
    })

    socketConnection.on('authentication-failed', (error) => {
      debugLog('Authentication failed', { error })
      socketConnection.disconnect()
      setSocketState('error')
    })

    socketConnection.on('error', (error) => {
      debugLog('Socket error', { error })
      
      // Don't show user-facing errors for WebRTC signaling issues
      if (error.message && error.message.includes('not found in room')) {
        return
      }
      
      toast.error(error.message || 'Connection error')
    })

    socketConnection.on('connect_error', (error) => {
      debugLog('Connection error', { error })
      setSocketState('error')
    })

    socketConnection.on('disconnect', () => {
      debugLog('Socket disconnected', {})
      hasJoinedRef.current = false
      setSocketState('disconnected')
    })

    socketConnection.on('connection-quality', (quality) => {
      debugLog('Connection quality update', { quality })
      setConnectionQuality(quality)
      setDebugInfo(prev => ({ ...prev, connectionQuality: quality }))
    })

    return () => {
      mounted = false
      debugLog('Socket cleanup', {})
      if (socketConnection.connected) {
        socketConnection.disconnect()
      }
      socketRef.current = null
    }
  }, [debugLog])

  // Join class room function
  const joinClassRoom = useCallback(() => {
    if (hasJoinedRef.current || !socketRef.current?.connected || !isMediaInitializedRef.current) {
      debugLog('Cannot join class', {
        hasJoined: hasJoinedRef.current,
        socketConnected: socketRef.current?.connected,
        mediaReady: isMediaInitializedRef.current
      })
      return
    }

    const roomId = classData.roomId || classData._id || `fallback_${Date.now()}`
    debugLog('Joining class', { roomId })
    
    socketRef.current.emit('join-class', {
      roomId: roomId,
      classId: classData.id || classData._id,
      user
    })
    
    hasJoinedRef.current = true
  }, [classData, user, debugLog])

  // Remove peer connection
  const removePeer = useCallback((userId: string) => {
    const peerWrapper = peersMapRef.current[userId];
    if (!peerWrapper) return;

    debugLog('Removing peer', { userId });
    
    try {
      peerWrapper.pc.close();
    } catch (err) {
      debugLog('Peer close error', { userId, error: err.message });
    }
    
    delete peersMapRef.current[userId];
    
    // Update participants state
    setParticipants(prev => {
      const newParticipants = new Map(prev);
      const existing = newParticipants.get(userId);
      if (existing) {
        newParticipants.set(userId, {
          ...existing,
          stream: undefined
        });
      }
      return newParticipants;
    });
    
    // Update debug info
    setDebugInfo(prev => {
      const newPeerConnections = new Map(prev.peerConnections);
      newPeerConnections.delete(userId);
      return { ...prev, peerConnections: newPeerConnections };
    });
  }, [debugLog]);

  // Create WebRTC peer connection
  const createPeer = useCallback((userId: string, isInitiator: boolean, participantUser: any) => {
    debugLog('Creating peer', { userId, isInitiator, participantUser });

    if (!localStreamRef.current || !isMediaInitializedRef.current) {
      debugLog('Media not ready for peer creation', { userId })
      setTimeout(() => {
        createPeer(userId, isInitiator, participantUser)
      }, 2000)
      return
    }

    if (!socketRef.current?.connected) {
      debugLog('Socket not connected for peer creation', { userId })
      return
    }

    // Check if peer already exists and is in a valid state
    if (peersMapRef.current[userId]) {
      const existingState = peersMapRef.current[userId].pc.connectionState;
      const existingIceState = peersMapRef.current[userId].pc.iceConnectionState;
      
      // Only reuse if in good state (not failed/disconnected)
      if (existingState === 'connected' || existingState === 'connecting' || 
          (existingState === 'new' && existingIceState !== 'failed')) {
        debugLog('Peer already exists and valid', { userId, connectionState: existingState, iceState: existingIceState });
        return peersMapRef.current[userId].pc;
      }
      
      // Clean up stale connections
      debugLog('Cleaning stale peer', { userId, oldState: existingState, iceState: existingIceState });
      try {
        peersMapRef.current[userId].pc.close();
      } catch (e) {
        debugLog('Error closing stale peer', { userId, error: e.message });
      }
      delete peersMapRef.current[userId];
    }

    try {
      // Create new peer connection
      debugLog('Creating new peer connection', { userId });
      const pc = new RTCPeerConnection(ICE_SERVERS);

      debugLog('Peer connection created', { 
        userId, 
        streamId: localStreamRef.current.id,
        videoTracks: localStreamRef.current.getVideoTracks().length,
        audioTracks: localStreamRef.current.getAudioTracks().length
      });
      
      // Add our local tracks to the connection
      const tracks = localStreamRef.current.getTracks();
      debugLog('Adding local tracks', { userId, trackCount: tracks.length });

      tracks.forEach((track) => {
        debugLog('Adding track', { userId, trackKind: track.kind, trackId: track.id });
        pc.addTrack(track, localStreamRef.current!);
      });

      // Set up event handlers
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        debugLog('Track event received', { 
          userId, 
          streamId: stream.id,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
          event
        });

        // Check if tracks are actually available
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        debugLog('Stream tracks detail', {
          userId,
          audioTracks: audioTracks.map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
          videoTracks: videoTracks.map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        });

        // Update participant with stream
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          const existing = newParticipants.get(userId) || {};
          
          const updatedParticipant = {
            ...existing,
            userId,
            user: participantUser,
            stream: stream
          };
          
          newParticipants.set(userId, updatedParticipant);
          debugLog('Updated participant with stream', { userId, hasStream: !!stream });
          return newParticipants;
        });
        
        // Update debug info
        setDebugInfo(prev => {
          const newPeerConnections = new Map(prev.peerConnections);
          newPeerConnections.set(userId, {
            initiator: isInitiator,
            connected: true,
            hasRemoteStream: true,
            iceState: pc.iceConnectionState,
            signalingState: pc.signalingState,
            streamId: stream.id
          });
          return { ...prev, peerConnections: newPeerConnections };
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          debugLog('ICE candidate generated', { 
            userId, 
            candidate: event.candidate,
            candidateType: event.candidate.candidate.includes('typ relay') ? 'relay' : 
                           event.candidate.candidate.includes('typ srflx') ? 'srflx' : 'host'
          });
          
          if (socketRef.current?.connected) {
            socketRef.current.emit('ice-candidate', {
              roomId: classData.roomId,
              to: userId,
              from: user.id,
              candidate: event.candidate
            });
          }
        } else {
          debugLog('ICE candidate generation complete', { userId });
        }
      };

      pc.onconnectionstatechange = () => {
        debugLog('Connection state change', { 
          userId, 
          state: pc.connectionState 
        });
        
        setConnectionStats(prev => ({
          ...prev,
          connectionState: pc.connectionState
        }));
        
        // Update debug info
        setDebugInfo(prev => {
          const newPeerConnections = new Map(prev.peerConnections);
          const peerInfo = newPeerConnections.get(userId) || {};
          newPeerConnections.set(userId, {
            ...peerInfo,
            connected: pc.connectionState === 'connected'
          });
          return { ...prev, peerConnections: newPeerConnections };
        });

        // Handle connection failures with proper recovery
        if (pc.connectionState === 'failed') {
          debugLog('Connection failed, will attempt recovery', { userId });
          
          // Clean up failed connection
          removePeer(userId);
          
          // Attempt recovery after delay, but only if we're the initiator
          const shouldReconnect = user.id > userId; // Same logic as initial connection
          if (shouldReconnect) {
            debugLog('Attempting connection recovery as initiator', { userId });
            setTimeout(() => {
              if (!peersMapRef.current[userId]) { // Only if not already reconnected
                setParticipants(prev => {
                  const participant = prev.get(userId);
                  if (participant) {
                    createPeer(userId, true, participant.user);
                  }
                  return prev;
                });
              }
            }, 3000 + Math.random() * 2000); // Random delay to avoid collision
          } else {
            debugLog('Waiting for other user to reconnect', { userId });
          }
        } else if (pc.connectionState === 'disconnected') {
          debugLog('Connection disconnected, monitoring for recovery', { userId });
          // Don't immediately recreate on disconnect - might recover
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        debugLog('ICE connection state change', { userId, iceState });
        
        // Track when ICE checking starts
        if (iceState === 'checking') {
          peersMapRef.current[userId].iceCheckingStartTime = Date.now();
        } else if (iceState === 'connected' || iceState === 'completed' || iceState === 'failed') {
          peersMapRef.current[userId].iceCheckingStartTime = undefined;
        }
        
        setConnectionStats(prev => ({
          ...prev,
          iceState
        }));
        
        // Update debug info
        setDebugInfo(prev => {
          const newPeerConnections = new Map(prev.peerConnections);
          const peerInfo = newPeerConnections.get(userId) || {};
          newPeerConnections.set(userId, {
            ...peerInfo,
            iceState
          });
          return { ...prev, peerConnections: newPeerConnections };
        });

        // Monitor if ICE gets stuck
        if (iceState === 'checking') {
          setTimeout(() => {
            if (pc.iceConnectionState === 'checking') {
              debugLog('ICE stuck in checking state', { userId, duration: '5s' });
              // Try to restart ICE
              try {
                pc.restartIce();
                debugLog('ICE restart triggered', { userId });
              } catch (e) {
                debugLog('ICE restart failed', { userId, error: e.message });
              }
            }
          }, 5000);
        }
      };

      pc.onsignalingstatechange = () => {
        const signalingState = pc.signalingState;
        debugLog('Signaling state change', { userId, signalingState });
        
        setConnectionStats(prev => ({
          ...prev,
          signalingState
        }));
        
        // Update debug info
        setDebugInfo(prev => {
          const newPeerConnections = new Map(prev.peerConnections);
          const peerInfo = newPeerConnections.get(userId) || {};
          newPeerConnections.set(userId, {
            ...peerInfo,
            signalingState
          });
          return { ...prev, peerConnections: newPeerConnections };
        });
      };

      // Store the peer connection
      peersMapRef.current[userId] = {
        pc,
        queuedCandidates: []
      };

      // If we're the initiator, create an offer
      if (isInitiator) {
        debugLog('Creating offer', { userId });
        
        pc.createOffer()
          .then(offer => {
            debugLog('Offer created', { userId, offerType: offer.type });
            return pc.setLocalDescription(offer);
          })
          .then(() => {
            debugLog('Local description set', { userId });
            if (socketRef.current?.connected && pc.localDescription) {
              socketRef.current.emit('offer', {
                roomId: classData.roomId,
                to: userId,
                from: user.id,
                offer: pc.localDescription
              });
              debugLog('Offer sent', { userId });
            }
          })
          .catch(error => {
            debugLog('Peer creation error', { userId, error: error.message });
          });
      }

    } catch (error) {
      debugLog('Peer creation error', { userId, error: error.message });
    }
  }, [classData?.roomId, user?.id, debugLog]);

  // Handle incoming offer with proper collision resolution
  const handleOffer = useCallback(async (from: string, offer: RTCSessionDescriptionInit) => {
    debugLog('Offer received', { from, offerType: offer.type });
    
    // Check if we already have a valid connection to this user
    const existingPeer = peersMapRef.current[from];
    if (existingPeer && (
        existingPeer.pc.connectionState === 'connected' || 
        existingPeer.pc.iceConnectionState === 'connected'
    )) {
      debugLog('Already connected to peer, ignoring offer', { from });
      return;
    }

    // Create peer if it doesn't exist or is closed
    if (!existingPeer || existingPeer.pc.signalingState === 'closed') {
      debugLog('Creating peer for offer', { from });
      setParticipants(prev => {
        const participant = prev.get(from);
        if (participant) {
          createPeer(from, false, participant.user);
        }
        return prev;
      });
      
      // Wait for peer creation
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const peerWrapper = peersMapRef.current[from];
    if (!peerWrapper) {
      debugLog('No peer for offer after creation', { from });
      return;
    }

    try {
      // Handle signaling collision properly using polite/impolite pattern
      const isPolite = user.id < from; // Use user ID comparison to determine politeness
      
      if (peerWrapper.pc.signalingState !== 'stable') {
        debugLog('Not in stable state for offer', { 
          from, 
          currentState: peerWrapper.pc.signalingState,
          isPolite
        });
        
        // Polite peer backs off from collision, impolite peer ignores
        if (peerWrapper.pc.signalingState === 'have-local-offer') {
          if (isPolite) {
            debugLog('Polite peer: Backing off from collision', { from });
            // Roll back local offer
            await peerWrapper.pc.setLocalDescription({type: 'rollback'});
          } else {
            debugLog('Impolite peer: Ignoring collision offer', { from });
            return; // Ignore the incoming offer
          }
        }
      }

      debugLog('Setting remote description', { from });
      await peerWrapper.pc.setRemoteDescription(new RTCSessionDescription(offer));
      debugLog('Remote description set', { from });

      // Create answer
      debugLog('Creating answer', { from });
      const answer = await peerWrapper.pc.createAnswer();
      debugLog('Answer created', { from, answerType: answer.type });

      await peerWrapper.pc.setLocalDescription(answer);
      debugLog('Local description set', { from });

      // Send answer
      if (socketRef.current?.connected) {
        socketRef.current.emit('answer', {
          roomId: classData.roomId,
          to: from,
          from: user.id,
          answer: peerWrapper.pc.localDescription
        });
        debugLog('Answer sent', { from });
      }

      // Process any queued ICE candidates now that remote description is set
      if (peerWrapper.queuedCandidates.length > 0) {
        debugLog('Processing queued ICE candidates after offer', { from, count: peerWrapper.queuedCandidates.length });
        for (const candidate of peerWrapper.queuedCandidates) {
          try {
            await peerWrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            debugLog('Queued candidate error', { from, error: error.message });
          }
        }
        peerWrapper.queuedCandidates = [];
      }
    } catch (error) {
      debugLog('Offer handling error', { from, error: error.message, currentState: peerWrapper.pc.signalingState });
      
      // Don't remove peer on error - try to recover
      if (error.name === 'InvalidStateError') {
        debugLog('Invalid state error - will retry with new peer', { from });
        removePeer(from);
        setTimeout(() => {
          setParticipants(prev => {
            const participant = prev.get(from);
            if (participant) {
              createPeer(from, false, participant.user);
            }
            return prev;
          });
        }, 500);
      }
    }
  }, [classData?.roomId, user?.id, debugLog, createPeer, removePeer]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (from: string, answer: RTCSessionDescriptionInit) => {
    debugLog('Answer received', { from, answerType: answer.type });

    const peerWrapper = peersMapRef.current[from];
    if (!peerWrapper) {
      debugLog('No peer for answer', { from });
      return;
    }

    // Handle different signaling states more gracefully
    try {
      // Check current state and handle accordingly
      if (peerWrapper.pc.signalingState === 'have-local-offer') {
        // Normal case - we're expecting an answer to our offer
        debugLog('Setting remote description from answer', { from });
        await peerWrapper.pc.setRemoteDescription(new RTCSessionDescription(answer));
        debugLog('Remote description set from answer', { from });
      } else if (peerWrapper.pc.signalingState === 'stable') {
        // We're already connected, no need to process this answer
        debugLog('Already connected, ignoring answer', { from });
        return;
      } else {
        // Unexpected state, try to recover
        debugLog('Unexpected signaling state for answer', { 
          from, 
          currentState: peerWrapper.pc.signalingState 
        });
        
        // Try to set the answer anyway
        try {
          await peerWrapper.pc.setRemoteDescription(new RTCSessionDescription(answer));
          debugLog('Remote description set in unexpected state', { from });
        } catch (error) {
          debugLog('Failed to set remote description', { from, error: error.message });
        }
      }

      // Process queued ICE candidates
      if (peerWrapper.queuedCandidates.length > 0) {
        debugLog('Processing queued ICE candidates', { from, count: peerWrapper.queuedCandidates.length });
        for (const candidate of peerWrapper.queuedCandidates) {
          try {
            await peerWrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            debugLog('Queued candidate error', { from, error: error.message });
          }
        }
        peerWrapper.queuedCandidates = [];
      }
    } catch (error) {
      debugLog('Answer handling error', { 
        from, 
        error: error.message,
        currentState: peerWrapper.pc.signalingState
      });
    }
  }, [debugLog]);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    debugLog('ICE candidate received', { 
      from, 
      candidate: candidate ? candidate.candidate : 'null',
      candidateType: candidate?.candidate?.includes('typ relay') ? 'relay' : 
                     candidate?.candidate?.includes('typ srflx') ? 'srflx' : 'host'
    });

    const peerWrapper = peersMapRef.current[from];
    if (!peerWrapper) {
      debugLog('No peer for ICE candidate', { from });
      return;
    }

    try {
      // If remote description is set, add the candidate immediately
      if (peerWrapper.pc.remoteDescription) {
        debugLog('Adding ICE candidate', { from, remoteDescription: 'exists' });
        await peerWrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
        debugLog('ICE candidate added', { from });
      } else {
        // Otherwise, queue the candidate
        debugLog('Queueing ICE candidate', { from, remoteDescription: 'not set' });
        peerWrapper.queuedCandidates.push(candidate);
      }
    } catch (error) {
      debugLog('ICE candidate error', { from, error: error.message });
    }
  }, [debugLog]);

  // Enhanced connection diagnostics and health monitoring
  useEffect(() => {
    const checkConnections = () => {
      let connectedCount = 0;
      let failedCount = 0;
      let connectingCount = 0;
      
      Object.entries(peersMapRef.current).forEach(([userId, peerWrapper]) => {
        if (peerWrapper.pc) {
          const pc = peerWrapper.pc;
          const connectionState = pc.connectionState;
          const iceState = pc.iceConnectionState;
          
          // Count connection states
          if (connectionState === 'connected') connectedCount++;
          else if (connectionState === 'failed') failedCount++;
          else if (connectionState === 'connecting' || iceState === 'checking') connectingCount++;
          
          debugLog('Connection status', {
            userId,
            iceState,
            signalingState: pc.signalingState,
            connectionState,
            hasRemoteDescription: !!pc.remoteDescription,
            hasLocalDescription: !!pc.localDescription,
            gatheringState: pc.iceGatheringState,
            queuedCandidates: peerWrapper.queuedCandidates.length
          });

          // Detect stuck connections
          if (iceState === 'checking' && peerWrapper.iceCheckingStartTime) {
            const checkingDuration = Date.now() - peerWrapper.iceCheckingStartTime;
            if (checkingDuration > 15000) { // 15 seconds timeout
              debugLog('Connection stuck in checking state', { 
                userId, 
                duration: checkingDuration,
                action: 'will-restart-ice'
              });
              
              // Try ICE restart
              try {
                pc.restartIce();
                peerWrapper.iceCheckingStartTime = Date.now(); // Reset timer
              } catch (error) {
                debugLog('ICE restart failed', { userId, error: error.message });
              }
            }
          }

          // Check if we have a stream but it's not showing up
          const participant = participants.get(userId);
          if (participant?.stream) {
            const videoTracks = participant.stream.getVideoTracks();
            const audioTracks = participant.stream.getAudioTracks();
            
            debugLog('Participant stream status', {
              userId,
              hasStream: !!participant.stream,
              videoTracks: videoTracks.length,
              audioTracks: audioTracks.length,
              videoEnabled: videoTracks.length > 0 ? videoTracks[0].enabled : false,
              audioEnabled: audioTracks.length > 0 ? audioTracks[0].enabled : false
            });
          } else if (connectionState === 'connected' && !participant?.stream) {
            debugLog('Connected but no stream', { userId, action: 'investigating' });
          }
        }
      });
      
      // Update overall connection quality
      const totalConnections = Object.keys(peersMapRef.current).length;
      let quality: 'good' | 'average' | 'poor' = 'good';
      
      if (totalConnections > 0) {
        const connectedRatio = connectedCount / totalConnections;
        if (connectedRatio < 0.5) quality = 'poor';
        else if (connectedRatio < 0.8) quality = 'average';
      }
      
      if (quality !== connectionQuality) {
        setConnectionQuality(quality);
        debugLog('Connection quality changed', {
          quality,
          connected: connectedCount,
          failed: failedCount,
          connecting: connectingCount,
          total: totalConnections
        });
      }
    };
    
    const interval = setInterval(checkConnections, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [debugLog, participants, connectionQuality]);

  // Add ICE connection timeout check
  useEffect(() => {
    const iceTimeoutCheck = () => {
      Object.entries(peersMapRef.current).forEach(([userId, peerWrapper]) => {
        if (peerWrapper.pc.iceConnectionState === 'checking' && peerWrapper.iceCheckingStartTime) {
          // Check how long it's been checking
          const checkingTime = Date.now() - peerWrapper.iceCheckingStartTime;
          
          if (checkingTime > 10000) { // 10 seconds timeout
            debugLog('ICE connection timeout', { userId, checkingTime });
            
            // Restart ICE
            try {
              peerWrapper.pc.restartIce();
              debugLog('ICE restart triggered due to timeout', { userId });
            } catch (error) {
              debugLog('ICE restart failed', { userId, error: error.message });
            }
          }
        }
      });
    };
    
    const interval = setInterval(iceTimeoutCheck, 2000);
    return () => clearInterval(interval);
  }, [debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debugLog('Component unmounting', {});
      
      // Clean up peers
      Object.values(peersMapRef.current).forEach(peerWrapper => {
        try {
          peerWrapper.pc.close();
        } catch (error) {
          debugLog('Peer close error on unmount', { error: error.message });
        }
      });
      peersMapRef.current = {};

      // Clean up local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [debugLog]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) {
      debugLog('Waiting for socket', {});
      return;
    }

    debugLog('Setting up socket handlers', {});

    const handlers = {
      'class-joined': async (data) => {
        debugLog('Class joined', {
          participantsCount: data.participants?.length || 0,
          chatHistoryCount: data.chatHistory?.length || 0
        });

        // Process existing participants
        const existingParticipants = new Map();
        if (data.participants && Array.isArray(data.participants)) {
          data.participants.forEach((participant, index) => {
            if (participant.userId !== user.id) {
              existingParticipants.set(participant.userId, {
                userId: participant.userId,
                user: participant.user,
                isHandRaised: participant.isHandRaised || false
              });

              // FIXED: Role-based initiation with fallback
              const isCurrentInstructor = user?.roleId?.name === 'INSTRUCTOR';
              const isParticipantInstructor = participant.user?.roleId?.name === 'INSTRUCTOR';
              
              let shouldInitiate = false;
              let delay = 1000 + (index * 500);
              
              if (isCurrentInstructor && !isParticipantInstructor) {
                shouldInitiate = true; // Instructor always initiates to students
                debugLog('Instructor will initiate to existing student', {
                  participantId: participant.userId,
                  thisUserId: user.id
                });
              } else if (!isCurrentInstructor && isParticipantInstructor) {
                shouldInitiate = false; // Student waits for instructor
                debugLog('Student waiting for existing instructor to initiate', {
                  participantId: participant.userId,
                  thisUserId: user.id
                });
                // Fallback timeout
                setTimeout(() => {
                  if (!peersMapRef.current[participant.userId]) {
                    debugLog('Instructor fallback timeout - student initiating', { participantId: participant.userId });
                    createPeer(participant.userId, true, participant.user);
                  }
                }, 8000);
              } else {
                // Same role - use ID comparison + guarantee one initiates
                shouldInitiate = user.id > participant.userId;
                debugLog('Same role - ID comparison for existing participant', {
                  participantId: participant.userId,
                  thisUserId: user.id,
                  shouldInitiate
                });
                
                // IMPORTANT: Fallback to ensure connection happens
                if (!shouldInitiate) {
                  setTimeout(() => {
                    if (!peersMapRef.current[participant.userId]) {
                      debugLog('ID fallback timeout - lower ID initiating', { participantId: participant.userId });
                      createPeer(participant.userId, true, participant.user);
                    }
                  }, 6000 + Math.random() * 2000);
                }
              }
              
              if (shouldInitiate) {
                setTimeout(() => {
                  if (localStreamRef.current && isMediaInitializedRef.current) {
                    createPeer(participant.userId, true, participant.user);
                  }
                }, delay);
              }
            }
          });
        }

        setParticipants(existingParticipants);

        // Add chat history
        if (data.chatHistory && data.chatHistory.length > 0) {
          setChatMessages(data.chatHistory);
        }
      },

      'participant-joined': (data) => {
        debugLog('Participant joined', {
          userId: data.userId,
          name: `${data.user.firstName} ${data.user.lastName}`
        });

        // Add to participants state
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          newParticipants.set(data.userId, {
            userId: data.userId,
            user: data.user,
            isHandRaised: false
          });
          return newParticipants;
        });

        // Add system message
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} joined the class`,
          from: { id: 'system', firstName: 'System', lastName: '' },
          timestamp: new Date(),
          type: 'system'
        });

        // Use polite/impolite pattern to determine who initiates
        const shouldInitiate = user.id > data.userId; // Higher ID initiates
        
        if (shouldInitiate) {
          debugLog('This user will initiate connection', { 
            thisUserId: user.id,
            newUserId: data.userId,
            shouldInitiate 
          });
          
          // Create peer connection to new participant with delay to avoid collision
          const attemptPeerCreation = (attempt = 1) => {
            if (attempt <= 5) {
              setTimeout(() => {
                if (localStreamRef.current && isMediaInitializedRef.current) {
                  createPeer(data.userId, true, data.user);
                } else {
                  attemptPeerCreation(attempt + 1);
                }
              }, attempt * 500); // Reduced delay since we're avoiding collision
            }
          };
          
          attemptPeerCreation(1);
        } else {
          debugLog('Waiting for other user to initiate connection', { 
            thisUserId: user.id,
            newUserId: data.userId,
            shouldInitiate 
          });
        }
      },

      'participant-left': (data) => {
        debugLog('Participant left', {
          userId: data.userId,
          name: `${data.user.firstName} ${data.user.lastName}`
        });

        // Add system message
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} left the class`,
          from: { id: 'system', firstName: 'System', lastName: '' },
          timestamp: new Date(),
          type: 'system'
        });

        // Clean up peer connection
        removePeer(data.userId);
      },

      'offer': (data) => {
        handleOffer(data.from, data.offer);
      },

      'answer': (data) => {
        handleAnswer(data.from, data.answer);
      },

      'ice-candidate': (data) => {
        handleIceCandidate(data.from, data.candidate);
      },

      'chat-message': (data) => {
        debugLog('Chat message received', data);
        addChatMessage({
          id: data.id || Date.now().toString(),
          message: data.message,
          from: data.from,
          timestamp: new Date(data.timestamp),
          type: data.type || 'text'
        });
      },

      'screen-share-started': (data) => {
        debugLog('Screen share started', { user: data.user });
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} started screen sharing`,
          from: { id: 'system' },
          timestamp: new Date(),
          type: 'system'
        });
      },

      'screen-share-stopped': () => {
        debugLog('Screen share stopped', {});
        addChatMessage({
          id: Date.now().toString(),
          message: `Screen sharing stopped`,
          from: { id: 'system' },
          timestamp: new Date(),
          type: 'system'
        });
      },

      'hand-raised': (data) => {
        debugLog('Hand raised', { userId: data.userId });
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          const participant = newParticipants.get(data.userId);
          if (participant) {
            newParticipants.set(data.userId, {
              ...participant,
              isHandRaised: true
            });
          }
          return newParticipants;
        });
      },

      'hand-lowered': (data) => {
        debugLog('Hand lowered', { userId: data.userId });
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          const participant = newParticipants.get(data.userId);
          if (participant) {
            newParticipants.set(data.userId, {
              ...participant,
              isHandRaised: false
            });
            }
          return newParticipants;
        });
      },

      'new-poll': (poll) => {
        debugLog('New poll', poll);
        setCurrentPoll(poll);
        addChatMessage({
          id: poll.id,
          message: `New poll: ${poll.question}`,
          from: { id: 'system' },
          timestamp: poll.createdAt,
          type: 'poll'
        });
      },

      'poll-vote': (updatedPoll) => {
        debugLog('Poll vote', updatedPoll);
        setCurrentPoll(updatedPoll);
      },

      'webrtc-error': (error) => {
        debugLog('WebRTC error received', error);
        
        // Handle specific error types
        switch (error.type) {
          case 'target-not-found':
            debugLog('Target user not found, will retry connection later', { to: error.to });
            // Don't remove peer immediately - they might reconnect
            break;
          case 'ice-candidate-failed':
            debugLog('ICE candidate failed', { to: error.to });
            break;
          default:
            debugLog('Unknown WebRTC error', error);
        }
      }
    };

    // Register event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      debugLog('Cleaning up socket handlers', {});
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, createPeer, user, debugLog, handleOffer, handleAnswer, handleIceCandidate, removePeer]);

  // Add message to chat
  const addChatMessage = (message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  // Toggle audio mute
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        debugLog('Audio toggled', { enabled: audioTrack.enabled });
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          mediaStatus: {
            ...prev.mediaStatus,
            hasAudio: audioTrack.enabled
          }
        }));
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        debugLog('Video toggled', { enabled: videoTrack.enabled });
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          mediaStatus: {
            ...prev.mediaStatus,
            hasVideo: videoTrack.enabled
          }
        }));
      }
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    debugLog('Toggle screen share', { currentState: isScreenSharing });
    
    try {
      if (isScreenSharing) {
        debugLog('Stopping screen share', {});
        
        // Get camera stream back
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24 }
          },
          audio: true
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Update all peer connections
        Object.values(peersMapRef.current).forEach(peerWrapper => {
          const senders = peerWrapper.pc.getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );
          
          if (videoSender && stream.getVideoTracks().length > 0) {
            videoSender.replaceTrack(stream.getVideoTracks()[0]);
          }
        });

        setIsScreenSharing(false);
        socket?.emit('stop-screen-share', { roomId: classData.roomId });
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          mediaStatus: {
            ...prev.mediaStatus,
            isScreenSharing: false
          }
        }));

        debugLog('Screen share stopped', {});

      } else {
        debugLog('Starting screen share', {});
        
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 15, max: 30 },
            width: { max: 1920 },
            height: { max: 1080 }
          },
          audio: true
        });

        debugLog('Screen stream obtained', {
          videoTracks: screenStream.getVideoTracks().length,
          audioTracks: screenStream.getAudioTracks().length
        });

        localStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Update all peer connections
        Object.values(peersMapRef.current).forEach(peerWrapper => {
          const senders = peerWrapper.pc.getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );
          
          if (videoSender && screenStream.getVideoTracks().length > 0) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });

        setIsScreenSharing(true);
        socket?.emit('start-screen-share', { roomId: classData.roomId });
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          mediaStatus: {
            ...prev.mediaStatus,
            isScreenSharing: true
          }
        }));

        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          debugLog('Screen share ended by user', {});
          toggleScreenShare();
        };

        debugLog('Screen share started', {});
      }
    } catch (error) {
      debugLog('Screen share error', { error: error.message });
    }
  };

  // Send chat message
  const sendChatMessage = () => {
    if (newMessage.trim() && socket) {
      debugLog('Sending message', { message: newMessage });
      socket.emit('send-message', {
        roomId: classData.roomId,
        message: newMessage
      });
      setNewMessage('');
    }
  };

  // Toggle hand raise
  const toggleHandRaise = () => {
    setIsHandRaised(!isHandRaised);
    if (socket) {
      if (!isHandRaised) {
        debugLog('Raising hand', {});
        socket.emit('raise-hand', { roomId: classData.roomId });
      } else {
        debugLog('Lowering hand', {});
        socket.emit('lower-hand', { roomId: classData.roomId });
      }
    }
  };

  // Create new poll (instructor only)
  const createPoll = (question: string, options: string[]) => {
    if (socket && isInstructor) {
      const poll = {
        id: Date.now().toString(),
        question,
        options,
        votes: {},
        createdBy: user.id,
        createdAt: new Date()
      };

      debugLog('Creating poll', poll);
      socket.emit('create-poll', {
        roomId: classData.roomId,
        poll
      });
    }
  };

  // Vote in poll
  const voteInPoll = (option: string) => {
    if (socket && currentPoll) {
      debugLog('Voting in poll', { option });
      socket.emit('vote-poll', {
        roomId: classData.roomId,
        pollId: currentPoll.id,
        option,
        userId: user.id
      });
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      classroomRef.current?.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => debugLog('Fullscreen error', { error: err.message }));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => debugLog('Exit fullscreen error', { error: err.message }));
    }
  };

  // Leave class
  const leaveClass = () => {
    debugLog('Leaving class', {});
    
    if (socket) {
      socket.emit('leave-class', { roomId: classData.roomId });
    }

    // Clean up peers
    Object.values(peersMapRef.current).forEach(peerWrapper => {
      try {
        peerWrapper.pc.close();
      } catch (error) {
        debugLog('Peer close error on leave', { error: error.message });
      }
    });
    peersMapRef.current = {};

    // Clean up local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
    }

    onLeave();
  };

  // Connection quality indicator
  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'good': return 'bg-green-500'
      case 'average': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  };

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
    debugLog('Debug mode toggled', { enabled: !debugMode });
  };

  // Debug mode rendering
  if (debugMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🔧 Live Class Debug Mode</h1>
            <p className="text-gray-400">Room ID: {classData?.roomId || 'unknown'}</p>
          </div>
          <Button onClick={toggleDebugMode} variant="outline" size="sm">
            Exit Debug Mode
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800 p-4 rounded-md">
            <h3 className="font-semibold text-blue-400 mb-2">WebRTC Status</h3>
            <div className="space-y-1 text-sm">
              <div>ICE: {connectionStats.iceState || 'unknown'}</div>
              <div>Signaling: {connectionStats.signalingState || 'unknown'}</div>
              <div>Connection: {connectionStats.connectionState || 'unknown'}</div>
              <div>TURN: {connectionStats.hasRelayCandidate ? '✅' : '❌'}</div>
              <div>Peers: {Object.keys(peersMapRef.current).length}</div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-md">
            <h3 className="font-semibold text-green-400 mb-2">Media Status</h3>
            <div className="space-y-1 text-sm">
              <div>Local Stream: {localStreamRef.current ? '✅' : '❌'}</div>
              <div>Video: {debugInfo.mediaStatus.hasVideo ? '✅' : '❌'}</div>
              <div>Audio: {debugInfo.mediaStatus.hasAudio ? '✅' : '❌'}</div>
              <div>Screen Share: {debugInfo.mediaStatus.isScreenSharing ? '✅' : '❌'}</div>
              <div>Participants: {participants.size + 1}</div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-md">
            <h3 className="font-semibold text-purple-400 mb-2">Socket Status</h3>
            <div className="space-y-1 text-sm">
              <div>State: {socketState}</div>
              <div>Connected: {socket?.connected ? '✅' : '❌'}</div>
              <div>ID: {socket?.id || 'N/A'}</div>
              <div>Quality: {connectionQuality}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-gray-800 p-4 rounded-md">
          <h3 className="font-semibold mb-2">Event Log</h3>
          <div className="h-64 overflow-y-auto text-sm">
            {debugInfo.events.slice().reverse().map((event, index) => (
              <div key={index} className="border-b border-gray-700 py-1">
                <div className="text-gray-400 text-xs">
                  {event.timestamp.toLocaleTimeString()}
                </div>
                <div className="font-medium">{event.type}</div>
                {event.data && (
                  <div className="text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Main UI rendering
  return (
    <TooltipProvider>
      <div ref={classroomRef} className="h-screen bg-gray-900 flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">{classData.name}</h1>
            <Badge variant="secondary" className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getConnectionQualityColor()}`}></div>
              <span className="text-xs">
                {participants.size + 1} participants
              </span>
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    debugLog('Manual reconnect triggered');
                    // Reconnect all peers
                    Array.from(participants.keys()).forEach(userId => {
                      const participant = participants.get(userId);
                      if (participant) {
                        debugLog('Reconnecting peer', { userId });
                        removePeer(userId);
                        setTimeout(() => createPeer(userId, true, participant.user), 100);
                      }
                    });
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reconnect all peers</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={toggleDebugMode}>
                  <Bug className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Debug Mode
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              </TooltipContent>
            </Tooltip>

            <Button variant="destructive" onClick={leaveClass}>
              Leave Class
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Video/content area */}
          <div className="flex-1 p-4">
            {showWhiteboard ? (
              <div className="w-full h-full bg-white rounded-lg flex items-center justify-center text-gray-800">
                Whiteboard would be displayed here
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
                {/* Local video */}
                <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                    {user.firstName} (You)
                  </div>
                  
                  {isHandRaised && (
                    <div className="absolute top-2 right-2 bg-yellow-500 p-1 rounded">
                      <Hand className="w-4 h-4" />
                    </div>
                  )}
                  
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-gray-700 flex flex-col items-center justify-center">
                      <Avatar className="w-16 h-16 mb-2">
                        <AvatarFallback className="text-lg">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.firstName} {user.lastName}</span>
                    </div>
                  )}
                </div>

                {/* Remote videos */}
                {Array.from(participants.values()).map((participant) => (
                  <ParticipantVideo key={participant.userId} participant={participant} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'participants' | 'chat' | 'polls')}
              className="flex-1 flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-3 bg-gray-700">
                <TabsTrigger value="chat" className="flex items-center space-x-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </TabsTrigger>
                <TabsTrigger value="participants" className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>People</span>
                </TabsTrigger>
                <TabsTrigger value="polls" className="flex items-center space-x-1">
                  <Clipboard className="w-4 h-4" />
                  <span>Polls</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col p-4 space-y-4">
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="space-y-1">
                      {message.type === 'system' ? (
                        <div className="text-gray-400 text-sm italic text-center">
                          {message.message}
                        </div>
                      ) : message.type === 'poll' ? (
                        <div className="bg-blue-900 p-3 rounded-lg">
                          <div className="text-blue-300 text-sm font-medium">
                            New poll: {message.message}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center space-x-2 mb-1">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {message.from.firstName.charAt(0)}{message.from.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">
                              {message.from.firstName} {message.from.lastName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-sm">
                            {message.message}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                  />
                  <Button onClick={sendChatMessage} size="sm">
                    Send
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="participants" className="flex-1 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Participants ({participants.size + 1})</h3>
                  </div>

                  <div className="space-y-2">
                    {/* Current user */}
                    <div className="flex items-center justify-between p-2 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-gray-400">
                            {isInstructor ? 'Instructor' : 'Student'}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    </div>

                    {/* Other participants */}
                    {Array.from(participants.values()).map((participant) => (
                      <div key={participant.userId} className="flex items-center justify-between p-2 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>
                              {participant.user.firstName.charAt(0)}{participant.user.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm flex items-center space-x-2">
                              <span>{participant.user.firstName} {participant.user.lastName}</span>
                              {participant.isHandRaised && (
                                <Hand className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              {participant.user.roleId?.name === 'INSTRUCTOR' ? 'Instructor' : 'Student'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="polls" className="flex-1 p-4">
                <div className="space-y-4">
                  {currentPoll ? (
                    <div>
                      <h3 className="font-medium mb-4">{currentPoll.question}</h3>
                      <div className="space-y-2">
                        {currentPoll.options.map((option, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => voteInPoll(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Clipboard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No active polls</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-center p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAudioMuted ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleAudio}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isAudioMuted ? 'Unmute' : 'Mute'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isVideoOff ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleVideo}
                >
                  {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleScreenShare}
                >
                  {isScreenSharing ? <ScreenShareOff className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isScreenSharing ? 'Stop sharing' : 'Share screen'}
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-gray-600 mx-2"></div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isHandRaised ? "default" : "secondary"}
                  size="sm"
                  onClick={toggleHandRaise}
                >
                  <Hand className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isHandRaised ? 'Lower hand' : 'Raise hand'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowWhiteboard(!showWhiteboard)}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showWhiteboard ? 'Hide whiteboard' : 'Show whiteboard'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// Participant Video Component
function ParticipantVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      // Check if we need to update the stream
      if (videoRef.current.srcObject !== participant.stream) {
        console.log('Setting video srcObject for participant', participant.userId);
        videoRef.current.srcObject = participant.stream
      }
      
      // Check track availability
      const videoTracks = participant.stream.getVideoTracks()
      const audioTracks = participant.stream.getAudioTracks()
      
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled)
      setHasAudio(audioTracks.length > 0 && audioTracks[0].enabled)

      const handleLoadedMetadata = () => {
        console.log(`Video metadata loaded for ${participant.user.firstName}`)
      }

      const handleCanPlay = () => {
        videoRef.current?.play().catch(err => {
          console.log(`Auto-play failed for ${participant.user.firstName}:`, err.message)
        })
      }

      if (videoRef.current) {
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
        videoRef.current.addEventListener('canplay', handleCanPlay)

        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
            videoRef.current.removeEventListener('canplay', handleCanPlay)
          }
        }
      }
    }
  }, [participant.stream, participant.userId])

  // Additional effect to monitor stream status
  useEffect(() => {
    if (participant.stream) {
      const interval = setInterval(() => {
        const videoTracks = participant.stream.getVideoTracks()
        const audioTracks = participant.stream.getAudioTracks()

        const newHasVideo = videoTracks.length > 0 && videoTracks[0].enabled;
        const newHasAudio = audioTracks.length > 0 && audioTracks[0].enabled;

        if (newHasVideo !== hasVideo || newHasAudio !== hasAudio) {
          console.log('Stream track status changed for participant', participant.userId, {
            hadVideo: hasVideo,
            hasVideo: newHasVideo,
            hadAudio: hasAudio,
            hasAudio: newHasAudio
          });
        }
        
        setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled)
        setHasAudio(audioTracks.length > 0 && audioTracks[0].enabled)
      }, 2000)
      
      return () => clearInterval(interval)
    }
  }, [participant.stream, hasVideo, hasAudio]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {participant.stream && hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
          <Avatar className="w-16 h-16 mb-2">
            <AvatarFallback className="text-lg">
              {participant.user.firstName.charAt(0)}{participant.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-center">
            {participant.user.firstName} {participant.user.lastName}
          </span>
          {!participant.stream && (
            <span className="text-xs text-gray-400 mt-1">Connecting...</span>
          )}
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
        {participant.user.firstName}
      </div>
      
      <div className="absolute bottom-2 right-2 flex space-x-1">
        {!hasAudio && (
          <div className="bg-red-500 p-1 rounded">
            <MicOff className="w-3 h-3" />
          </div>
        )}
        {!hasVideo && participant.stream && (
          <div className="bg-red-500 p-1 rounded">
            <VideoOff className="w-3 h-3" />
          </div>
        )}
      </div>
      
      {participant.isHandRaised && (
        <div className="absolute top-2 right-2 bg-yellow-500 p-1 rounded">
          <Hand className="w-4 h-4" />
        </div>
      )}
      
      {participant.user.roleId?.name === 'INSTRUCTOR' && (
        <div className="absolute top-2 left-2 bg-blue-500 px-2 py-1 rounded text-xs">
          Host
        </div>
      )}
    </div>
  )
}
