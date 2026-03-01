'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { io, Socket } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import dynamic from 'next/dynamic'

// Dynamic import for debug mode
const SocketDebugger = dynamic(() => import('./SocketDebugger'), { ssr: false })

import { Button } from './ui/button'
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
  Minimize
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { TooltipProvider } from '@radix-ui/react-tooltip'

// Dynamic imports
const Whiteboard = dynamic(() => import('./Whiteboard'), { ssr: false })
const PollComponent = dynamic(() => import('./Poll'), { ssr: false })

interface Participant {
  userId: string
  user: any
  peer?: SimplePeer.Instance
  stream?: MediaStream
  isHandRaised?: boolean
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

export default function ModernClassroom({ classData, user, enrollmentId, onLeave }) {
  // CRITICAL FIX: Only log on first mount to prevent re-mount detection
  const mountCountRef = useRef(0)
  
  useEffect(() => {
    mountCountRef.current += 1
    if (mountCountRef.current === 1) {
      console.log('🏛️ LiveClassRoom INITIAL mount with classData:', classData)
      console.log('👤 User data:', user)
    } else {
      console.warn('⚠️ LiveClassRoom re-mounting! Count:', mountCountRef.current)
    }
  }, [])

  // Debug mode - add ?debug=true or ?debug=webrtc to URL
  const [debugMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const debugParam = new URLSearchParams(window.location.search).get('debug')
      return debugParam === 'true' || debugParam === 'webrtc'
    }
    return false
  })
  
  const [webrtcDebugMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('debug') === 'webrtc'
    }
    return false
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
  const [isInstructor, setIsInstructor] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [currentPoll, setCurrentPoll] = useState<Poll | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'average' | 'poor'>('good');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const [connectionStats, setConnectionStats] = useState({
    iceState: '',
    signalingState: '',
    connectionState: '',
    hasRelayCandidate: false
  })

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map())
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const classroomRef = useRef<HTMLDivElement>(null)
  const pendingOffers = useRef<Map<string, any>>(new Map())
  const isMediaInitializedRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const hasJoinedRef = useRef(false)

  // Enhanced STUN/TURN test function
  const testSTUN = async () => {
    try {
      console.log('🧪 Testing STUN server connectivity...')
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efO8XQ995C6NTR8XA7',
            credential: 'q4zPrbAEwJJH4720'
          }
        ]
      })

      let hasCandidates = false
      let hasRelayCandidates = false
      
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          hasCandidates = true
          console.log('📝 ICE candidate:', e.candidate.candidate)
          
          if (e.candidate.candidate.includes('relay')) {
            hasRelayCandidates = true
            console.log('✅ TURN relay candidate found')
          }
        } else {
          console.log('✅ ICE gathering complete')
          console.log(`📊 Candidates found: ${hasCandidates}`)
          console.log(`📊 Relay candidates: ${hasRelayCandidates}`)
          
          if (!hasCandidates) {
            console.log('❌ No ICE candidates - STUN/TURN may be blocked')
          } else if (hasRelayCandidates) {
            console.log('✅ TURN server connectivity confirmed')
          } else {
            console.log('✅ STUN server connectivity confirmed')
          }

          setConnectionStats(prev => ({
            ...prev,
            hasRelayCandidate: hasRelayCandidates
          }))
        }
      }

      pc.onicegatheringstatechange = () => {
        console.log('🔄 ICE gathering state:', pc.iceGatheringState)
      }

      // Create a data channel to force candidate gathering
      pc.createDataChannel('test')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log('📝 Created offer for connectivity test')

      // Cleanup after test
      setTimeout(() => {
        pc.close()
      }, 5000)

    } catch (error) {
      console.error('❌ Connectivity test failed:', error)
    }
  }

  // Initialize local media stream - FIXED VERSION
  useEffect(() => {
    let mounted = true
    
    const initializeMedia = async () => {
      if (isMediaInitializedRef.current) {
        console.log('✅ Media already initialized, skipping...')
        return
      }

      try {
        console.log('🎥 Requesting media permissions...')
        
        // Check permissions first if available
        if (navigator.permissions) {
          try {
            const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })
            const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
            console.log('📹 Camera permission:', cameraPermission.state)
            console.log('🎤 Microphone permission:', microphonePermission.state)
          } catch (e) {
            console.log('⚠️ Permission API not supported')
          }
        }

        console.log('🎥 Getting user media...')
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
          // Component unmounted, cleanup stream
          stream.getTracks().forEach(track => track.stop())
          return
        }

        console.log('✅ Media stream obtained:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamId: stream.id
        })

        // Log track details
        stream.getVideoTracks().forEach((track, index) => {
          console.log(`📹 Video Track ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            settings: track.getSettings()
          })
        })

        stream.getAudioTracks().forEach((track, index) => {
          console.log(`🎤 Audio Track ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            settings: track.getSettings()
          })
        })

        localStreamRef.current = stream
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          console.log('✅ Local video element configured')
          
          // Add event listeners for video element
          localVideoRef.current.onloadedmetadata = () => {
            console.log('✅ Local video metadata loaded')
          }
          
          localVideoRef.current.oncanplay = () => {
            console.log('✅ Local video can play')
          }
          
          localVideoRef.current.onerror = (e) => {
            console.error('❌ Local video error:', e)
          }
        } else {
          console.error('❌ Local video ref not available')
        }

        isMediaInitializedRef.current = true
        console.log('✅ Media initialization complete')

        // Join room if socket is ready
        if (socketRef.current?.connected && !hasJoinedRef.current) {
          console.log('🚪 Media ready, joining class now...')
          joinClassRoom()
        }

      } catch (error) {
        console.error('❌ Error accessing media devices:', error)
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          constraint: error.constraint
        })
        
        // Try with audio only
        try {
          console.log('🔄 Trying audio-only fallback...')
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          
          if (!mounted) {
            audioStream.getTracks().forEach(track => track.stop())
            return
          }
          
          localStreamRef.current = audioStream
          isMediaInitializedRef.current = true
          console.log('✅ Audio-only stream obtained')

          // Join room if socket is ready
          if (socketRef.current?.connected && !hasJoinedRef.current) {
            console.log('🚪 Audio-only media ready, joining class now...')
            joinClassRoom()
          }
        } catch (audioError) {
          console.error('❌ Audio-only fallback failed:', audioError)
        }
      }
    }

    initializeMedia()

    return () => {
      mounted = false
      console.log('🧹 Media initialization cleanup...')
    }
  }, []) // Empty dependency array - only run once

  // Join class room function
  const joinClassRoom = useCallback(() => {
    if (hasJoinedRef.current || !socketRef.current?.connected || !isMediaInitializedRef.current) {
      console.log('❌ Cannot join class:', {
        hasJoined: hasJoinedRef.current,
        socketConnected: socketRef.current?.connected,
        mediaReady: isMediaInitializedRef.current
      })
      return
    }

    const roomId = classData.roomId || classData.id || classData._id || `fallback_${Date.now()}`
    console.log('🚪 Joining class with roomId:', roomId)
    // console.log('🚪 Joining class with roomId:', roomId)
    
    socketRef.current.emit('join-class', {
      roomId: roomId,
      classId: classData.id || classData._id,
      user
    })
    
    hasJoinedRef.current = true
  }, [classData, user])

  // Initialize socket connection - FIXED VERSION
  useEffect(() => {
    let mounted = true
    
    const token = api.getToken()
    if (!token) {
      console.log('❌ No auth token found')
      return
    }

    if (socketRef.current?.connected) {
      console.log('✅ Socket already connected, skipping initialization')
      return
    }

    console.log('🔌 Initializing socket connection...')
    const socketConnection = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      auth: { token }
    })

    console.log('🔌 Socket connection created, waiting for connection...')

    socketConnection.on('connect', () => {
      if (!mounted) return
      
      console.log('✅ Socket connected with ID:', socketConnection.id)
      testSTUN()
      
      // Authenticate first
      console.log('🔐 Authenticating with server...')
      socketConnection.emit('authenticate', { token })
    })

    socketConnection.on('authenticated', (data) => {
      if (!mounted) return
      
      if (data.success) {
        console.log('✅ Authenticated successfully')
        setSocket(socketConnection)
        socketRef.current = socketConnection
        
        // Join room if media is ready
        if (isMediaInitializedRef.current && !hasJoinedRef.current) {
          console.log('🚪 Socket ready, media ready, joining class now...')
          joinClassRoom()
        }
      }
    })

    socketConnection.on('authentication-failed', (error) => {
      console.error('❌ Authentication failed:', error)
      socketConnection.disconnect()
    })

    socketConnection.on('error', (error) => {
      console.error('🔴 Socket error:', error)
    })

    socketConnection.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error)
    })

    socketConnection.on('disconnect', () => {
      console.log('🔌 Disconnected from socket server')
      hasJoinedRef.current = false
    })

    socketConnection.on('connection-quality', (quality) => {
      setConnectionQuality(quality)
    })

    return () => {
      mounted = false
      console.log('🧹 Cleaning up socket connection...')
      if (socketConnection.connected) {
        socketConnection.disconnect()
      }
      socketRef.current = null
    }
  }, []) // Empty dependency array - only run once

  // Check if user is instructor
  useEffect(() => {
    const instructorRole = user?.roleId?.name === 'INSTRUCTOR' || user?.role === 'instructor'
    setIsInstructor(instructorRole)
    console.log('👨‍🏫 User is instructor:', instructorRole)
  }, [user])

  // Validate class data has required roomId
  useEffect(() => {
    if (classData) {
      console.log('🏠 Class data roomId:', classData.roomId)
      if (!classData.roomId) {
        console.error('❌ Class data is missing roomId:', classData)
        const fallbackRoomId = `room_${classData.id || classData._id || Date.now()}`
        console.log('🔄 Using fallback roomId:', fallbackRoomId)
        classData.roomId = fallbackRoomId
      }
    }
  }, [classData])

  // Create WebRTC peer connection - FIXED FOR MEDIA SHARING
  const createPeer = useCallback((userId: string, isInitiator: boolean, participantUser: any) => {
    console.group(`🎯 CREATEPEER CALLED for ${userId}`)
    console.log('📊 Full State Check:', {
      userId,
      initiator: isInitiator,
      participantName: `${participantUser.firstName} ${participantUser.lastName}`,
      hasLocalStream: !!localStreamRef.current,
      localStreamId: localStreamRef.current?.id,
      isMediaInitialized: isMediaInitializedRef.current,
      socketConnected: socketRef.current?.connected,
      socketId: socketRef.current?.id,
      currentUserId: user?.id,
      classDataRoomId: classData?.roomId
    })

    // CRITICAL FIX: Ensure media is ready before creating peer
    if (!localStreamRef.current || !isMediaInitializedRef.current) {
      console.log('⏳ Media not ready for peer creation, retrying in 2000ms...', {
        hasLocalStream: !!localStreamRef.current,
        isMediaInitialized: isMediaInitializedRef.current,
        userId
      })
      console.groupEnd()
      setTimeout(() => {
        console.log('🔄 Retry attempt for peer creation:', userId)
        createPeer(userId, isInitiator, participantUser)
      }, 2000) // Increased timeout
      return
    }

    if (!socketRef.current?.connected) {
      console.error('❌ Socket not connected, cannot create peer')
      console.groupEnd()
      return
    }

    // CRITICAL: Check if SimplePeer is available
    if (typeof SimplePeer !== 'function') {
      console.error('❌ SimplePeer is not available!', typeof SimplePeer)
      console.groupEnd()
      return
    }
    
    console.log('✅ SimplePeer is available:', typeof SimplePeer)
    console.log('✅ All checks passed, proceeding with SimplePeer creation for:', userId)

    if (!socketRef.current?.connected) {
      console.error('❌ Cannot create peer: Socket not connected')
      return
    }

     const existingPeer = peersRef.current.get(userId);
  if (existingPeer && !existingPeer.destroyed) {
    console.log('⚠️ Peer already exists for', userId, 'skipping creation');
    return existingPeer;
  }
  
  // Clean up if exists but is dead
  if (existingPeer) {
    console.log('🧹 Cleaning up dead peer for', userId);
    existingPeer.destroy();
    peersRef.current.delete(userId);
  }

    console.log('🚀 Starting peer creation for:', userId)

    try {
      console.log(`🔧 Creating SimplePeer instance for ${userId}`)
      console.log(`📊 SimplePeer config:`, {
        initiator: isInitiator,
        trickle: false,
        hasStream: !!localStreamRef.current,
        streamTracks: localStreamRef.current ? {
          video: localStreamRef.current.getVideoTracks().length,
          audio: localStreamRef.current.getAudioTracks().length
        } : null
      })
      
      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: localStreamRef.current,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: 'turn:relay1.expressturn.com:3478',
              username: 'efO8XQ995C6NTR8XA7',
              credential: 'q4zPrbAEwJJH4720'
            }
          ],
          iceTransportPolicy: 'all'
        }
      })
      
      console.log(`✅ SimplePeer instance created for ${userId}:`, peer)
      
      console.log(`🎥 Peer created with local stream:`, {
        userId,
        streamId: localStreamRef.current.id,
        videoTracks: localStreamRef.current.getVideoTracks().length,
        audioTracks: localStreamRef.current.getAudioTracks().length,
        videoEnabled: localStreamRef.current.getVideoTracks()[0]?.enabled,
        audioEnabled: localStreamRef.current.getAudioTracks()[0]?.enabled
      })

      // Store peer immediately
      peersRef.current.set(userId, peer)
      console.log(`✅ Peer created and stored for ${userId}`)

      // Set up event handlers with enhanced logging
      // WebRTC Signal Handler - FIXED for media sharing
      console.log(`🎧 Setting up signal handler for ${userId}`)
      
      // CRITICAL FIX: Test signal handler immediately
      const signalHandler = (signal) => {
        console.group(`📡 WebRTC Signal - ${userId}`)
        console.log('✅ SIGNAL EVENT TRIGGERED!')
        console.log('Signal type:', signal.type || 'candidate')
        console.log('Full signal:', signal)
        console.log('Socket connected:', !!socketRef.current?.connected)
        
        if (socketRef.current?.connected) {
          const signalData = {
            roomId: classData.roomId,
            to: userId,
            from: user.id
          }

          // Handle different signal types with proper emission
          if (signal.type === 'offer') {
            console.log(`📤 Sending OFFER to ${userId}`)
            socketRef.current.emit('offer', { 
              ...signalData, 
              offer: signal 
            })
          } 
          else if (signal.type === 'answer') {
            console.log(`📤 Sending ANSWER to ${userId}`)
            socketRef.current.emit('answer', { 
              ...signalData, 
              answer: signal 
            })
          }
          else if (signal.candidate) {
            // CRITICAL FIX: Send complete ICE candidate data
            console.log(`📤 Sending ICE candidate to ${userId}`)
            console.log('Candidate details:', {
              candidate: signal.candidate,
              sdpMLineIndex: signal.sdpMLineIndex,
              sdpMid: signal.sdpMid
            })
            
            socketRef.current.emit('ice-candidate', { 
              ...signalData, 
              candidate: signal // Send the complete signal object
            })
          }
        } else {
          console.error('❌ Cannot send signal: Socket not connected')
        }
        console.groupEnd()
      }
      
      peer.on('signal', signalHandler)
      
      // CRITICAL TEST: Check if signal handler is working
      setTimeout(() => {
        console.log(`🧪 Testing signal handler for ${userId}`)
        console.log(`📊 Peer state:`, {
          initiator: peer.initiator,
          connected: peer.connected,
          destroyed: peer.destroyed,
          readyState: peer._pc?.signalingState,
          iceConnectionState: peer._pc?.iceConnectionState,
          iceGatheringState: peer._pc?.iceGatheringState
        })
      }, 1000)


      console.log(`🎧 Setting up stream handler for ${userId}`)
      
      peer.on('stream', (remoteStream) => {
        console.log(`🎥 STREAM EVENT TRIGGERED! Received stream from ${userId}:`, {
          streamId: remoteStream.id,
          audioTracks: remoteStream.getAudioTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
          participantName: `${participantUser.firstName} ${participantUser.lastName}`
        })

        // Log remote track details
        remoteStream.getTracks().forEach((track, index) => {
          console.log(`📡 Remote Track ${index} from ${userId}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          })
        })

        // Update participant with stream
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          const existing = newParticipants.get(userId) || {}
          
          const updatedParticipant = {
            ...existing,
            userId,
            user: participantUser,
            peer,
            stream: remoteStream
          }
          
          newParticipants.set(userId, updatedParticipant)
          console.log(`✅ Updated participant ${userId} with stream`)
          return newParticipants
        })
      })

      peer.on('connect', () => {
        console.log(`✅ Peer connected to ${userId}`)
        
        setConnectionStats(prev => ({
          ...prev,
          connectionState: 'connected'
        }))
      })

      console.log(`🎧 Setting up error handler for ${userId}`)
      
      peer.on('error', (err) => {
        console.group(`❌ PEER ERROR with ${userId}`)
        console.error('Error details:', err)
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
        console.groupEnd()
        
        // Clean up failed peer
        peersRef.current.delete(userId)
        
        // Remove stream from participant but keep participant info
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          const existing = newParticipants.get(userId)
          if (existing) {
            newParticipants.set(userId, {
              ...existing,
              stream: undefined,
              peer: undefined
            })
          }
          return newParticipants
        })
      })

      console.log(`🎧 Setting up connect handler for ${userId}`)
      
      peer.on('connect', () => {
        console.log(`✅ PEER CONNECTED with ${userId}!`)
      })

      console.log(`🎧 Setting up close handler for ${userId}`)
      
      peer.on('close', () => {
        console.log(`🔌 Peer connection closed with ${userId}`)
        peersRef.current.delete(userId)
        
        // Remove stream but keep participant
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          const existing = newParticipants.get(userId)
          if (existing) {
            newParticipants.set(userId, {
              ...existing,
              stream: undefined,
              peer: undefined
            })
          }
          return newParticipants
        })
      })

      // Monitor ICE connection state with enhanced logging
      if (peer._pc) {
        peer._pc.oniceconnectionstatechange = () => {
          const state = peer._pc.iceConnectionState
          console.group(`🧊 ICE STATE CHANGE for ${userId}`)
          console.log('ICE Connection State:', state)
          console.log('Signaling State:', peer._pc.signalingState)
          console.log('Connection State:', peer._pc.connectionState)
          
          setConnectionStats(prev => ({
            ...prev,
            iceState: state
          }))
          
          // Enhanced state logging
          switch (state) {
            case 'connected':
              console.log(`✅ ICE connection ESTABLISHED for ${userId}`)
              break
            case 'completed':
              console.log(`✅ ICE connection COMPLETED for ${userId}`)
              break
            case 'failed':
              console.error(`❌ ICE connection FAILED for ${userId}`)
              break
            case 'disconnected':
              console.warn(`⚠️ ICE connection DISCONNECTED for ${userId}`)
              break
            case 'closed':
              console.log(`🔌 ICE connection CLOSED for ${userId}`)
              break
            default:
              console.log(`🔄 ICE connection state: ${state} for ${userId}`)
          }
          console.groupEnd()
        }

        peer._pc.onsignalingstatechange = () => {
          console.log(`📶 Signaling state for ${userId}:`, peer._pc.signalingState)
          setConnectionStats(prev => ({
            ...prev,
            signalingState: peer._pc.signalingState
          }))
        }

        peer._pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`🧊 Local ICE candidate generated for ${userId}:`, {
              type: event.candidate.type,
              protocol: event.candidate.protocol,
              address: event.candidate.address
            })
          }
        }
      }

      // CRITICAL FIX: Force signal generation and emission
      if (isInitiator) {
        console.log(`🚀 INITIATOR: Force starting negotiation for ${userId}`)
        setTimeout(() => {
          if (!peer.destroyed && socketRef.current?.connected) {
            console.log(`⚡ FORCE: Creating and sending offer for ${userId}`)
            try {
              peer._pc.createOffer().then(offer => {
                console.log(`📝 MANUAL OFFER created for ${userId}`)
                
                // Set local description
                return peer._pc.setLocalDescription(offer).then(() => {
                  console.log(`📤 FORCE SENDING OFFER to ${userId}`)
                  
                  // Manually emit the offer
                  socketRef.current.emit('offer', {
                    roomId: classData.roomId,
                    to: userId,
                    from: user.id,
                    offer: offer
                  })
                  
                  console.log(`✅ MANUAL OFFER SENT to ${userId}`)
                })
              }).catch(err => {
                console.error(`❌ Manual offer creation failed for ${userId}:`, err)
              })
            } catch (err) {
              console.error(`❌ Manual negotiation failed for ${userId}:`, err)
            }
          } else {
            console.error(`❌ Cannot force negotiation: peer destroyed or socket disconnected`)
          }
        }, 3000) // Increased delay
      }

      console.log(`✅ Peer setup complete for ${userId}`)
      console.groupEnd()

    } catch (error) {
      console.error(`❌ Error creating peer for ${userId}:`, error)
      console.groupEnd()
    }
  }, [classData?.roomId, user?.id])

  // Socket event handlers - ENHANCED VERSION
  useEffect(() => {
    if (!socket) {
      console.log('⏳ Waiting for socket connection...')
      return
    }

    console.log('🔗 Setting up socket event handlers...')

    const handlers = {
      'class-joined': async (data) => {
        console.log('✅ Successfully joined class:', {
          participantsCount: data.participants?.length || 0,
          chatHistoryCount: data.chatHistory?.length || 0,
          hasLocalStream: !!localStreamRef.current,
          currentUserId: user?.id
        })

        // Process existing participants
        const existingParticipants = new Map()
        if (data.participants && Array.isArray(data.participants)) {
          console.log('👥 Processing existing participants:', data.participants.length)
          
          data.participants.forEach((participant, index) => {
            if (participant.userId !== user.id) {
              console.log(`🔗 Creating peer for existing participant: ${participant.user.firstName} (WE INITIATE)`)
              console.log(`👤 Adding existing participant ${index + 1}:`, {
                userId: participant.userId,
                name: `${participant.user.firstName} ${participant.user.lastName}`,
                isHandRaised: participant.isHandRaised || false
              })

              existingParticipants.set(participant.userId, {
                userId: participant.userId,
                user: participant.user,
                isHandRaised: participant.isHandRaised || false
              })

              // FIXED: The newer user should initiate connections to existing users
              console.log(`🔗 Creating peer for existing participant: ${participant.user.firstName} (WE INITIATE)`)
              setTimeout(() => {
                createPeer(participant.userId, true, participant.user) // TRUE - we initiate
              }, 1000 + (index * 500)) // Stagger peer creation
            }
          })
        }

        setParticipants(existingParticipants)
        console.log(`📊 Total participants in room: ${existingParticipants.size + 1}`)

        // Add chat history
        if (data.chatHistory && data.chatHistory.length > 0) {
          console.log('💬 Loading chat history:', data.chatHistory.length, 'messages')
          setChatMessages(data.chatHistory)
        }
      },

      'participant-joined': (data) => {
        console.log('👋 New participant joined:', {
          userId: data.userId,
          name: `${data.user.firstName} ${data.user.lastName}`,
          totalParticipants: participants.size + 2, // +1 for new participant, +1 for current user
          currentUserId: user?.id
        })

        // Add to participants state
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          newParticipants.set(data.userId, {
            userId: data.userId,
            user: data.user,
            isHandRaised: false
          })
          return newParticipants
        })

        // Add system message
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} joined the class`,
          from: { id: 'system', firstName: 'System', lastName: '' },
          timestamp: new Date(),
          type: 'system'
        })

        // CRITICAL FIX: EXISTING users should initiate connection to NEW users
        console.log(`🔗 WILL create peer connection to new participant: ${data.user.firstName}`)
        console.log(`📊 Current state:`, {
          hasLocalStream: !!localStreamRef.current,
          isMediaInitialized: isMediaInitializedRef.current,
          socketConnected: !!socket,
          participantUserId: data.userId
        })
        
        // FORCE peer creation with multiple retries
        const attemptPeerCreation = (attempt = 1) => {
          console.log(`🔄 Peer creation attempt ${attempt} for: ${data.user.firstName}`)
          
          if (attempt <= 5) { // Max 5 attempts
            setTimeout(() => {
              console.log(`⏰ Attempt ${attempt}: Creating peer for ${data.user.firstName}`)
              console.log(`📊 Media check - Stream:`, !!localStreamRef.current, 'Initialized:', isMediaInitializedRef.current)
              
              if (localStreamRef.current && isMediaInitializedRef.current) {
                createPeer(data.userId, true, data.user) // WE initiate to them
              } else {
                console.log(`❌ Attempt ${attempt} failed - retrying...`)
                attemptPeerCreation(attempt + 1)
              }
            }, attempt * 1000) // Progressive delay
          } else {
            console.error(`❌ FAILED to create peer for ${data.user.firstName} after 5 attempts`)
          }
        }
        
        attemptPeerCreation(1)
      },

      'participant-left': (data) => {
        console.log('👋 Participant left:', {
          userId: data.userId,
          name: `${data.user.firstName} ${data.user.lastName}`
        })

        // Add system message
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} left the class`,
          from: { id: 'system', firstName: 'System', lastName: '' },
          timestamp: new Date(),
          type: 'system'
        })

        // Clean up peer connection
        const peer = peersRef.current.get(data.userId)
        if (peer) {
          console.log(`🧹 Cleaning up peer for departed participant: ${data.userId}`)
          peer.destroy()
          peersRef.current.delete(data.userId)
        }

        // Remove from participants state
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          newParticipants.delete(data.userId)
          console.log(`📊 Participants after leave: ${newParticipants.size + 1}`)
          return newParticipants
        })
      },

      'offer': (data) => {
        console.group(`📥 OFFER RECEIVED from ${data.from}`)
        console.log('✅ OFFER EVENT FIRED!')
        console.log('Offer details:', {
          from: data.from,
          to: user?.id,
          hasOffer: !!data.offer,
          offerType: data.offer?.type,
          sdpLength: data.offer?.sdp?.length || 0,
          roomId: data.roomId
        })

        const peer = peersRef.current.get(data.from)
        if (peer && !peer.destroyed) {
          console.log(`✅ Processing offer for existing peer: ${data.from}`)
          try {
            peer.signal(data.offer)
            console.log(`✅ Offer signaled successfully to peer ${data.from}`)
          } catch (error) {
            console.error(`❌ Error signaling offer from ${data.from}:`, error)
          }
        } else {
          console.log(`⏳ No peer found for ${data.from}, creating peer to handle offer`)
          
          // Find participant info
          setParticipants(prev => {
            const participant = prev.get(data.from)
            if (participant) {
              console.log(`🔗 Creating peer for offer from: ${participant.user.firstName} (WE DON'T INITIATE)`)
              createPeer(data.from, false, participant.user) // FALSE - they initiated
              
              // Process offer after peer creation
              setTimeout(() => {
                const newPeer = peersRef.current.get(data.from)
                if (newPeer && !newPeer.destroyed) {
                  console.log(`✅ Processing delayed offer for ${data.from}`)
                  try {
                    newPeer.signal(data.offer)
                    console.log(`✅ Delayed offer signaled successfully to peer ${data.from}`)
                  } catch (error) {
                    console.error(`❌ Error signaling delayed offer from ${data.from}:`, error)
                  }
                }
              }, 500)
            } else {
              console.error(`❌ Participant ${data.from} not found in participants list`)
            }
            return prev
          })
        }
        console.groupEnd()
      },

      'answer': (data) => {
        console.group(`📥 ANSWER RECEIVED from ${data.from}`)
        console.log('✅ ANSWER EVENT FIRED!')
        console.log('Answer details:', {
          from: data.from,
          to: user?.id,
          hasAnswer: !!data.answer,
          answerType: data.answer?.type,
          sdpLength: data.answer?.sdp?.length || 0,
          roomId: data.roomId
        })

        const peer = peersRef.current.get(data.from)
        if (peer && !peer.destroyed) {
          console.log(`✅ Processing answer for peer: ${data.from}`)
          try {
            peer.signal(data.answer)
            console.log(`✅ Answer signaled successfully to peer ${data.from}`)
          } catch (error) {
            console.error(`❌ Error signaling answer from ${data.from}:`, error)
          }
        } else {
          console.error(`❌ No active peer found for answer from ${data.from}`)
        }
      },

      'ice-candidate': (data) => {
        console.log(`📥 ICE candidate received from ${data.from}:`, {
          from: data.from,
          hasCandidate: !!data.candidate,
          candidateType: data.candidate?.candidate?.includes('relay') ? 'TURN' : 'STUN',
          currentUserId: user?.id
        })

        const peer = peersRef.current.get(data.from)
        if (peer && !peer.destroyed) {
          console.log(`✅ Adding ICE candidate for peer: ${data.from}`)
          try {
            peer.signal(data.candidate)
            console.log(`✅ ICE candidate signaled successfully to peer ${data.from}`)
          } catch (error) {
            console.error(`❌ Error adding ICE candidate from ${data.from}:`, error)
          }
        } else {
          console.error(`❌ No active peer found for ICE candidate from ${data.from}`)
        }
      },

      'chat-message': (data) => {
        console.log('💬 Received chat message:', data)
        addChatMessage({
          id: data.id || Date.now().toString(),
          message: data.message,
          from: data.from,
          timestamp: new Date(data.timestamp),
          type: data.type || 'text'
        })
      },

      'screen-share-started': (data) => {
        console.log('🖥️ Screen share started by:', data.user)
        addChatMessage({
          id: Date.now().toString(),
          message: `${data.user.firstName} ${data.user.lastName} started screen sharing`,
          from: { id: 'system' },
          timestamp: new Date(),
          type: 'system'
        })
      },

      'screen-share-stopped': () => {
        console.log('🖥️ Screen share stopped')
        addChatMessage({
          id: Date.now().toString(),
          message: `Screen sharing stopped`,
          from: { id: 'system' },
          timestamp: new Date(),
          type: 'system'
        })
      },

      'hand-raised': (data) => {
        console.log('✋ Hand raised by:', data.userId)
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          const participant = newParticipants.get(data.userId)
          if (participant) {
            newParticipants.set(data.userId, {
              ...participant,
              isHandRaised: true
            })
          }
          return newParticipants
        })
      },

      'hand-lowered': (data) => {
        console.log('✋ Hand lowered by:', data.userId)
        setParticipants(prev => {
          const newParticipants = new Map(prev)
          const participant = newParticipants.get(data.userId)
          if (participant) {
            newParticipants.set(data.userId, {
              ...participant,
              isHandRaised: false
            })
          }
          return newParticipants
        })
      },

      'new-poll': (poll) => {
        console.log('📊 New poll received:', poll)
        setCurrentPoll(poll)
        addChatMessage({
          id: poll.id,
          message: `New poll: ${poll.question}`,
          from: { id: 'system' },
          timestamp: poll.createdAt,
          type: 'poll'
        })
      },

      'poll-vote': (updatedPoll) => {
        console.log('📊 Poll vote received:', updatedPoll)
        setCurrentPoll(updatedPoll)
      }
    }

    // Register event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      console.log(`👂 Registering handler for: ${event}`)
      socket.on(event, handler)
    })

    return () => {
      console.log('🧹 Cleaning up socket event handlers...')
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler)
      })
    }
  }, [socket, createPeer, user]) // Stable dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...')
      
      // Clean up peers
      peersRef.current.forEach((peer, userId) => {
        console.log(`🧹 Destroying peer: ${userId}`)
        peer.destroy()
      })
      peersRef.current.clear()

      // Clean up local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log(`🛑 Stopping local track: ${track.kind}`)
          track.stop()
        })
      }
    }
  }, [])

  // Add message to chat
  const addChatMessage = (message: ChatMessage) => {
    setChatMessages(prev => [...prev, message])
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }

  // Toggle audio mute
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
        console.log('🎤 Audio toggled:', audioTrack.enabled ? 'ON' : 'OFF')
      }
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
        console.log('📹 Video toggled:', videoTrack.enabled ? 'ON' : 'OFF')
      }
    }
  }

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    console.log('🖥️ Toggling screen share, current state:', isScreenSharing)
    
    try {
      if (isScreenSharing) {
        console.log('🛑 Stopping screen share...')
        
        // Get camera stream back
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24 }
          },
          audio: true
        })

        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Update all peer connections
        peersRef.current.forEach((peer, userId) => {
          const videoTrack = stream.getVideoTracks()[0]
          if (videoTrack && peer.streams && peer.streams[0]) {
            console.log(`🔄 Replacing video track for peer: ${userId}`)
            peer.replaceTrack(peer.streams[0].getVideoTracks()[0], videoTrack, peer.streams[0])
          }
        })

        setIsScreenSharing(false)
        socket?.emit('stop-screen-share', { roomId: classData.roomId })
        console.log('✅ Screen share stopped')

      } else {
        console.log('▶️ Starting screen share...')
        
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 15, max: 30 },
            width: { max: 1920 },
            height: { max: 1080 }
          },
          audio: true
        })

        console.log('✅ Screen stream obtained:', {
          videoTracks: screenStream.getVideoTracks().length,
          audioTracks: screenStream.getAudioTracks().length
        })

        localStreamRef.current = screenStream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }

        // Update all peer connections
        peersRef.current.forEach((peer, userId) => {
          const videoTrack = screenStream.getVideoTracks()[0]
          if (videoTrack && peer.streams && peer.streams[0]) {
            console.log(`🔄 Replacing video track for screen share with peer: ${userId}`)
            peer.replaceTrack(peer.streams[0].getVideoTracks()[0], videoTrack, peer.streams[0])
          }
        })

        setIsScreenSharing(true)
        socket?.emit('start-screen-share', { roomId: classData.roomId })

        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          console.log('🖥️ Screen share ended by user')
          toggleScreenShare()
        }

        console.log('✅ Screen share started')
      }
    } catch (error) {
      console.error('❌ Error toggling screen share:', error)
    }
  }

  // Send chat message
  const sendChatMessage = () => {
    if (newMessage.trim() && socket) {
      console.log('💬 Sending message:', newMessage)
      socket.emit('send-message', {
        roomId: classData.roomId,
        message: newMessage
      })
      setNewMessage('')
    }
  }

  // Toggle hand raise
  const toggleHandRaise = () => {
    setIsHandRaised(!isHandRaised)
    if (socket) {
      if (!isHandRaised) {
        console.log('✋ Raising hand')
        socket.emit('raise-hand', { roomId: classData.roomId })
      } else {
        console.log('✋ Lowering hand')
        socket.emit('lower-hand', { roomId: classData.roomId })
      }
    }
  }

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
      }

      console.log('📊 Creating poll:', poll)
      socket.emit('create-poll', {
        roomId: classData.roomId,
        poll
      })
    }
  }

  // Vote in poll
  const voteInPoll = (option: string) => {
    if (socket && currentPoll) {
      console.log('📊 Voting in poll:', option)
      socket.emit('vote-poll', {
        roomId: classData.roomId,
        pollId: currentPoll.id,
        option,
        userId: user.id
      })
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      classroomRef.current?.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error('Error entering fullscreen:', err))
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error('Error exiting fullscreen:', err))
    }
  }

  // Leave class
  const leaveClass = () => {
    console.log('🚪 Leaving class...')
    
    if (socket) {
      socket.emit('leave-class', { roomId: classData.roomId })
    }

    // Clean up peers
    peersRef.current.forEach((peer, userId) => {
      console.log(`🧹 Destroying peer: ${userId}`)
      peer.destroy()
    })
    peersRef.current.clear()

    // Clean up local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`🛑 Stopping local track: ${track.kind}`)
        track.stop()
      })
    }

    onLeave()
  }

  // Connection quality indicator
  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'good': return 'bg-green-500'
      case 'average': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const ConnectionStatusPanel = () => (
    <div className="bg-gray-900 p-3 rounded-md text-xs text-white space-y-1">
      <div className="font-semibold text-blue-400">WebRTC Status</div>
      <div>ICE: {connectionStats.iceState}</div>
      <div>Signaling: {connectionStats.signalingState}</div>
      <div>Connection: {connectionStats.connectionState}</div>
      <div>TURN: {connectionStats.hasRelayCandidate ? '✅' : '❌'}</div>
      <div>Peers: {peersRef.current.size}</div>
    </div>
  )

  const MediaDebugPanel = () => (
    <div className="bg-gray-900 p-3 rounded-md text-xs text-white space-y-1">
      <div className="font-semibold text-green-400">Media Status</div>
      <div>Local Stream: {localStreamRef.current ? '✅' : '❌'}</div>
      <div>Video Tracks: {localStreamRef.current?.getVideoTracks().length || 0}</div>
      <div>Audio Tracks: {localStreamRef.current?.getAudioTracks().length || 0}</div>
      <div>Peers: {peersRef.current.size}</div>
      <div>Participants: {participants.size}</div>
      <div>Media Init: {isMediaInitializedRef.current ? '✅' : '❌'}</div>
    </div>
  )

  // Debug mode rendering
  if (debugMode) {
    const roomId = classData?.roomId || classData?._id || 'debug-room'
    return (
      <>
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-bold">🔧 Live Class Debug Mode</h1>
            <p className="text-gray-400">Room ID: {roomId}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ConnectionStatusPanel />
            <MediaDebugPanel />
            
            <div className="bg-gray-900 p-3 rounded-md text-xs text-white">
              <SocketDebugger socket={socket} roomId={roomId} />
            </div>
          </div>
        </div>
      </>
    )
  }

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
              <Whiteboard />
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
                    onLoadedMetadata={() => console.log('✅ Local video metadata loaded')}
                    onCanPlay={() => console.log('✅ Local video can play')}
                    onError={(e) => console.error('❌ Local video error:', e)}
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
                  <ParticipantVideo key={participant.userId} participant={participant} isInstructor={isInstructor} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
                          {currentPoll && (
                            <PollComponent poll={currentPoll} onVote={voteInPoll} />
                          )}
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
                    {isInstructor && (
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm">
                          <MicOff className="w-4 h-4" />
                          Mute all
                        </Button>
                        <Button variant="ghost" size="sm">
                          <VideoOff className="w-4 h-4" />
                          Stop all video
                        </Button>
                      </div>
                    )}
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
                        {isInstructor && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2">
                              <div className="space-y-1">
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                  <MicOff className="w-4 h-4 mr-2" />
                                  Mute
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                  <VideoOff className="w-4 h-4 mr-2" />
                                  Stop video
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-red-400">
                                  <Phone className="w-4 h-4 mr-2" />
                                  Remove
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
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
                      <PollComponent poll={currentPoll} onVote={voteInPoll} />
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Clipboard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No active polls</p>
                      {isInstructor && (
                        <Button 
                          className="mt-4"
                          onClick={() => createPoll('Sample question', ['Option 1', 'Option 2'])}
                        >
                          Create Poll
                        </Button>
                      )}
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

// Enhanced Participant Video Component
function ParticipantVideo({ participant, isInstructor }: { participant: Participant, isInstructor: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      console.log(`🎥 Setting up video for participant: ${participant.user.firstName}`, {
        streamId: participant.stream.id,
        videoTracks: participant.stream.getVideoTracks().length,
        audioTracks: participant.stream.getAudioTracks().length
      })

      videoRef.current.srcObject = participant.stream
      
      // Check track availability
      const videoTracks = participant.stream.getVideoTracks()
      const audioTracks = participant.stream.getAudioTracks()
      
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled)
      setHasAudio(audioTracks.length > 0 && audioTracks[0].enabled)

      console.log(`📊 Participant ${participant.user.firstName} media status:`, {
        hasVideo: videoTracks.length > 0 && videoTracks[0].enabled,
        hasAudio: audioTracks.length > 0 && audioTracks[0].enabled
      })

      // Add event listeners
      const handleLoadedMetadata = () => {
        console.log(`✅ Video metadata loaded for ${participant.user.firstName}`)
      }

      const handleCanPlay = () => {
        console.log(`✅ Video can play for ${participant.user.firstName}`)
        // Auto-play when ready
        videoRef.current?.play().catch(err => {
          console.log(`⚠️ Auto-play failed for ${participant.user.firstName}:`, err.message)
        })
      }

      const handleError = (e) => {
        console.error(`❌ Video error for ${participant.user.firstName}:`, e)
      }

      if (videoRef.current) {
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
        videoRef.current.addEventListener('canplay', handleCanPlay)
        videoRef.current.addEventListener('error', handleError)

        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
            videoRef.current.removeEventListener('canplay', handleCanPlay)
            videoRef.current.removeEventListener('error', handleError)
          }
        }
      }
    }
  }, [participant.stream, participant.user.firstName])

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

// Simple Poll Component placeholder
const SimplePollComponent = ({ poll, onVote }) => {
  return (
    <div className="space-y-2">
      {poll.options.map((option, index) => (
        <Button
          key={index}
          variant="outline"
          className="w-full justify-start"
          onClick={() => onVote(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
