const jwt = require('jsonwebtoken');
const config = require('../config');
const { userRepository } = require('../repositories');

class EnhancedSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.liveClasses = new Map();
    this.whiteboardData = new Map();
    this.screenSharePermissions = new Map();
    this.candidateTypes = new Map();
    this.debugLogs = new Map(); // Store debug logs per room
    
    // Add cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleRooms();
    }, 300000); // Clean up every 5 minutes
    
    // Add connection monitoring
    this.setupConnectionMonitoring();
    
    this.setupEventHandlers();
  }

  // Add debug log entry for a room
  addDebugLog(roomId, type, data) {
    if (!this.debugLogs.has(roomId)) {
      this.debugLogs.set(roomId, []);
    }
    
    const logEntry = {
      timestamp: new Date(),
      type,
      data,
      roomId
    };
    
    const logs = this.debugLogs.get(roomId);
    logs.push(logEntry);
    
    // Keep only last 100 entries per room
    if (logs.length > 100) {
      this.debugLogs.set(roomId, logs.slice(-100));
    }
    
    // Emit debug info to clients in debug mode
    this.io.to(roomId).emit('debug-info', {
      type,
      data,
      timestamp: logEntry.timestamp
    });
  }

  // Setup connection monitoring
  setupConnectionMonitoring() {
    // Monitor connection states periodically
    setInterval(() => {
      for (const [roomId, room] of this.liveClasses.entries()) {
        const now = Date.now();
        
        // Check for stale connections (no activity for 30 seconds)
        if (room.lastActivity && (now - room.lastActivity > 30000)) {
          this.addDebugLog(roomId, 'room-inactivity-warning', {
            lastActivity: new Date(room.lastActivity).toISOString(),
            inactiveFor: Math.round((now - room.lastActivity) / 1000) + ' seconds'
          });
        }
      }
    }, 15000); // Check every 15 seconds
  }

  // Clean up stale rooms to prevent memory leaks
  cleanupStaleRooms() {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour
    
    console.log('🧹 Running room cleanup...');
    let cleanedCount = 0;
    
    for (const [roomId, room] of this.liveClasses.entries()) {
      // Check if room is empty
      if (room.participants.size === 0) {
        console.log(`🧹 Cleaning up empty room: ${roomId}`);
        this.liveClasses.delete(roomId);
        this.whiteboardData.delete(roomId);
        this.debugLogs.delete(roomId);
        cleanedCount++;
      } 
      // Check if room hasn't had activity for a while
      else if (room.lastActivity && (now - room.lastActivity > staleThreshold)) {
        console.log(`🧹 Cleaning up inactive room: ${roomId}`);
        
        // Notify participants before cleaning up
        this.io.to(roomId).emit('room-timeout', {
          message: 'Room closed due to inactivity',
          roomId: roomId
        });
        
        // Disconnect all participants
        room.participants.forEach(participant => {
          const socket = this.io.sockets.sockets.get(participant.socketId);
          if (socket) {
            socket.leave(roomId);
            socket.emit('room-closed', {
              message: 'Room has been closed due to inactivity',
              roomId: roomId
            });
          }
        });
        
        this.liveClasses.delete(roomId);
        this.whiteboardData.delete(roomId);
        this.debugLogs.delete(roomId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} stale rooms`);
    }
  }

  // Check if user has better candidate type
  hasBetterCandidateType(userId, currentType) {
    if (!this.candidateTypes.has(userId)) return false;
    
    const userCandidateTypes = this.candidateTypes.get(userId);
    
    // Priority: relay > srflx > prflx > host
    const priority = {
      'relay': 4,
      'srflx': 3,
      'prflx': 2,
      'host': 1
    };
    
    const currentPriority = priority[currentType] || 0;
    
    // Check if we have any candidate with higher priority
    for (const type of userCandidateTypes) {
      if (priority[type] > currentPriority) {
        return true;
      }
    }
    
    return false;
  }

  // Track candidate type for optimization
  trackCandidateType(userId, candidateType) {
    if (!candidateType) return;
    
    if (!this.candidateTypes.has(userId)) {
      this.candidateTypes.set(userId, new Set());
    }
    
    this.candidateTypes.get(userId).add(candidateType);
  }

  // Clean up method to clear intervals
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      console.log('🧹 Cleanup interval stopped');
    }
  }

  setupEventHandlers() {
    console.log('📡 Setting up Socket.IO event handlers...');
    
    this.io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);
      this.addDebugLog('global', 'socket-connected', { socketId: socket.id });

      // Add connection timeout handler
      socket.conn.on("heartbeat", () => {
        // Update room activity on heartbeat
        if (socket.roomId) {
          const room = this.liveClasses.get(socket.roomId);
          if (room) {
            room.lastActivity = Date.now();
          }
        }
      });

      // Add debug handler for all socket events
      if (process.env.NODE_ENV === 'development') {
        socket.onAny((eventName, ...args) => {
          if (socket.roomId) {
            this.addDebugLog(socket.roomId, `socket-event-${eventName}`, {
              socketId: socket.id,
              data: args.length > 0 ? args[0] : 'No data'
            });
          }
        });
      }
      
      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          console.log('🔐 Authentication attempt for socket:', socket.id);
          this.addDebugLog('global', 'authentication-attempt', { socketId: socket.id });
          
          const { token } = data;
          
          if (!token) {
            console.log('❌ No token provided');
            this.addDebugLog('global', 'authentication-failed', { reason: 'No token provided', socketId: socket.id });
            socket.emit('authentication-failed', { message: 'No token provided' });
            return;
          }

          const decoded = jwt.verify(token, config.jwtSecret);
          const user = await userRepository.findById(decoded.userId, {
            populate: { path: 'roleId', select: 'name' }
          });
          
          if (user) {
            socket.user = user;
            socket.authenticated = true;
            socket.emit('authenticated', { success: true, user: user });
            this.addDebugLog('global', 'authentication-success', { 
              socketId: socket.id, 
              userId: user.id,
              userName: `${user.firstName} ${user.lastName}`
            });
          } else {
            console.log('❌ User not found in database');
            this.addDebugLog('global', 'authentication-failed', { reason: 'User not found', socketId: socket.id });
            socket.emit('authentication-failed', { message: 'User not found' });
          }
        } catch (error) {
          console.error('❌ Authentication error:', error.message);
          this.addDebugLog('global', 'authentication-error', { 
            error: error.message, 
            socketId: socket.id 
          });
          socket.emit('authentication-failed', { message: 'Invalid token' });
        }
      });
      
      // Join classroom
      socket.on('join-class', (data) => {
        console.log(`🧑‍🏫 User ${socket.user?.firstName || 'Unknown'} joining class...`);
        this.addDebugLog('global', 'join-class-attempt', {
          socketId: socket.id,
          userId: socket.user?.id,
          roomId: data.roomId
        });
        
        if (socket.authenticated) {
          this.handleJoinClass(socket, data);
        } else {
          this.addDebugLog('global', 'join-class-failed', {
            reason: 'Not authenticated',
            socketId: socket.id
          });
          socket.emit('error', { message: 'Authentication required' });
        }
      });

      // Debug info request
      socket.on('request-debug-info', (data) => {
        if (socket.roomId) {
          const logs = this.debugLogs.get(socket.roomId) || [];
          socket.emit('debug-info-history', logs);
        }
      });

      // Whiteboard events
      socket.on('join-whiteboard', (roomId) => {
        this.handleJoinWhiteboard(socket, roomId);
      });

      socket.on('whiteboard-draw', (drawingData) => {
        this.handleWhiteboardDraw(socket, drawingData);
      });

      socket.on('whiteboard-clear', () => {
        this.handleWhiteboardClear(socket);
      });

      socket.on('whiteboard-undo', (newDrawings) => {
        this.handleWhiteboardUndo(socket, newDrawings);
      });

      // Screen sharing
      socket.on('start-screen-share', (data) => {
        this.handleStartScreenShare(socket, data);
      });

      socket.on('stop-screen-share', (data) => {
        this.handleStopScreenShare(socket, data);
      });

      // Hand raising
      socket.on('raise-hand', (data) => {
        this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', (data) => {
        this.handleLowerHand(socket, data);
      });

      // Leave class
      socket.on('leave-class', (data) => {
        this.handleLeaveClass(socket, data);
      });

      // Chat
      socket.on('send-message', (message) => {
        this.handleSendMessage(socket, message);
      });

      // WebRTC signaling
      socket.on('offer', (data) => {
        this.handleWebRTCOffer(socket, data);
      });

      socket.on('answer', (data) => {
        this.handleWebRTCAnswer(socket, data);
      });

      socket.on('ice-candidate', (data) => {
        this.handleWebRTCIceCandidate(socket, data);
      });

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Disconnect
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket disconnected: ${socket.id}, reason: ${reason}`);
        this.addDebugLog('global', 'socket-disconnected', {
          socketId: socket.id,
          reason: reason
        });
        this.handleDisconnect(socket);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error(`🔴 Socket error for ${socket.id}:`, error);
        this.addDebugLog('global', 'socket-error', {
          socketId: socket.id,
          error: error
        });
      });
    });
  }

  handleJoinClass(socket, { roomId, classId, user }) {
    console.log(`🚪 User ${user.firstName} ${user.lastName} attempting to join class ${roomId}`);
    this.addDebugLog(roomId, 'join-class', {
      userId: socket.user?.id,
      userName: `${socket.user?.firstName} ${socket.user?.lastName}`,
      roomId: roomId
    });
    
    try {
      // Validate data
      if (!roomId || !user) {
        console.log('❌ Missing roomId or user data');
        this.addDebugLog(roomId, 'join-class-failed', {
          reason: 'Missing roomId or user data',
          userId: socket.user?.id
        });
        socket.emit('error', { message: 'Missing required data for joining class' });
        return;
      }

      console.log(`👥 Joining socket to room: ${roomId}`);
      socket.join(roomId);
      socket.roomId = roomId;
      socket.classId = classId;
      
      // Use the authenticated user from socket instead of passed user
      const authenticatedUser = socket.user || user;

      // Initialize room if doesn't exist
      if (!this.liveClasses.has(roomId)) {
        console.log(`🏠 Creating new room: ${roomId}`);
        this.liveClasses.set(roomId, {
          participants: new Map(),
          instructor: null,
          whiteboardData: [],
          chatHistory: [],
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
        
        this.addDebugLog(roomId, 'room-created', {
          roomId: roomId,
          createdAt: new Date().toISOString()
        });
      }

      const room = this.liveClasses.get(roomId);
      const isInstructor = authenticatedUser?.roleId?.name === 'INSTRUCTOR' || authenticatedUser?.role === 'instructor';
      
      // Add participant to room
      const participant = {
        userId: authenticatedUser.id,
        user: authenticatedUser,
        socketId: socket.id,
        joinedAt: new Date(),
        isInstructor: isInstructor,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isHandRaised: false,
        isScreenSharing: false
      };

      room.participants.set(authenticatedUser.id, participant);
      room.lastActivity = Date.now(); // Update activity time
      
      console.log(`✅ Participant added to room. Total participants: ${room.participants.size}`);
      this.addDebugLog(roomId, 'participant-added', {
        userId: authenticatedUser.id,
        userName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
        isInstructor: isInstructor,
        totalParticipants: room.participants.size
      });

      // Set instructor
      if (isInstructor) {
        room.instructor = socket.id;
        socket.isInstructor = true;
        console.log(`👨‍🏫 Instructor role assigned`);
        this.addDebugLog(roomId, 'instructor-assigned', {
          userId: authenticatedUser.id,
          userName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`
        });
      }

      // Get existing participants (excluding the current user)
      const existingParticipants = Array.from(room.participants.values())
        .filter(p => p.userId !== authenticatedUser.id);

      console.log(`📤 Notifying ${existingParticipants.length} existing participants about new user`);
      this.addDebugLog(roomId, 'notifying-participants', {
        count: existingParticipants.length
      });
      
      // Notify existing participants about new user
      socket.to(roomId).emit('participant-joined', {
        userId: authenticatedUser.id,
        user: authenticatedUser
      });

      console.log(`📥 Sending room data to new user`);
      
      // Send existing participants to new user and confirm join
      socket.emit('class-joined', {
        participants: existingParticipants,
        chatHistory: room.chatHistory || []
      });

      console.log(`✅ ${authenticatedUser.firstName} ${authenticatedUser.lastName} successfully joined ${roomId} as ${isInstructor ? 'instructor' : 'student'}`);
      console.log(`📊 Room ${roomId} now has ${room.participants.size} participants`);
      
      this.addDebugLog(roomId, 'join-class-success', {
        userId: authenticatedUser.id,
        userName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
        role: isInstructor ? 'instructor' : 'student',
        totalParticipants: room.participants.size
      });

    } catch (error) {
      console.error('❌ Error joining class:', error);
      this.addDebugLog(roomId, 'join-class-error', {
        error: error.message,
        userId: socket.user?.id
      });
      socket.emit('error', { message: 'Failed to join class: ' + error.message });
    }
  }

  handleJoinWhiteboard(socket, roomId) {
    socket.join(`whiteboard-${roomId}`);
    this.addDebugLog(roomId, 'whiteboard-joined', {
      userId: socket.user?.id
    });
    
    // Send existing whiteboard data
    if (this.whiteboardData.has(roomId)) {
      socket.emit('whiteboard-history', this.whiteboardData.get(roomId));
    }
  }

  handleWhiteboardDraw(socket, drawingData) {
    const roomId = socket.roomId;
    if (!roomId) return;

    // Update room activity
    const room = this.liveClasses.get(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }

    // Store drawing data
    if (!this.whiteboardData.has(roomId)) {
      this.whiteboardData.set(roomId, []);
    }
    
    this.whiteboardData.get(roomId).push(drawingData);

    // Broadcast to all users in the room
    socket.to(`whiteboard-${roomId}`).emit('whiteboard-drawing', drawingData);
    
    this.addDebugLog(roomId, 'whiteboard-draw', {
      userId: socket.user?.id,
      drawingData: drawingData
    });
  }

  handleWhiteboardClear(socket) {
    const roomId = socket.roomId;
    if (!roomId) return;

    // Update room activity
    const room = this.liveClasses.get(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }

    // Clear stored data
    this.whiteboardData.set(roomId, []);

    // Broadcast clear to all users
    this.io.to(`whiteboard-${roomId}`).emit('whiteboard-clear');
    
    this.addDebugLog(roomId, 'whiteboard-clear', {
      userId: socket.user?.id
    });
  }

  handleWhiteboardUndo(socket, newDrawings) {
    const roomId = socket.roomId;
    if (!roomId) return;

    // Update room activity
    const room = this.liveClasses.get(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }

    // Update stored data
    this.whiteboardData.set(roomId, newDrawings);

    // Broadcast to other users
    socket.to(`whiteboard-${roomId}`).emit('whiteboard-undo', newDrawings);
    
    this.addDebugLog(roomId, 'whiteboard-undo', {
      userId: socket.user?.id,
      newDrawingsCount: newDrawings.length
    });
  }

  handleStartScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (room && socket.user && room.participants.has(socket.user.id)) {
      const participant = room.participants.get(socket.user.id);
      participant.isScreenSharing = true;
      room.lastActivity = Date.now();
      
      // Broadcast update to all participants in room
      socket.to(roomId).emit('screen-share-started', {
        userId: socket.user.id,
        user: socket.user
      });
      
      console.log(`${socket.user.firstName} started screen sharing in room ${roomId}`);
      this.addDebugLog(roomId, 'screen-share-started', {
        userId: socket.user.id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    }
  }

  handleStopScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (room && socket.user && room.participants.has(socket.user.id)) {
      const participant = room.participants.get(socket.user.id);
      participant.isScreenSharing = false;
      room.lastActivity = Date.now();
      
      // Broadcast update to all participants in room
      socket.to(roomId).emit('screen-share-stopped', {
        userId: socket.user.id,
        user: socket.user
      });
      
      console.log(`${socket.user.firstName} stopped screen sharing in room ${roomId}`);
      this.addDebugLog(roomId, 'screen-share-stopped', {
        userId: socket.user.id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    }
  }

  handleRaiseHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (room && socket.user && room.participants.has(socket.user.id)) {
      const participant = room.participants.get(socket.user.id);
      participant.isHandRaised = true;
      room.lastActivity = Date.now();
      
      // Broadcast update to all participants in room
      socket.to(roomId).emit('hand-raised', {
        userId: socket.user.id,
        user: socket.user
      });
      
      console.log(`${socket.user.firstName} raised hand in room ${roomId}`);
      this.addDebugLog(roomId, 'hand-raised', {
        userId: socket.user.id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    }
  }

  handleLowerHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (room && socket.user && room.participants.has(socket.user.id)) {
      const participant = room.participants.get(socket.user.id);
      participant.isHandRaised = false;
      room.lastActivity = Date.now();
      
      // Broadcast update to all participants in room
      socket.to(roomId).emit('hand-lowered', {
        userId: socket.user.id,
        user: socket.user
      });
      
      console.log(`${socket.user.firstName} lowered hand in room ${roomId}`);
      this.addDebugLog(roomId, 'hand-lowered', {
        userId: socket.user.id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    }
  }

  handleLeaveClass(socket, { roomId }) {
    if (socket.user) {
      console.log(`${socket.user.firstName} ${socket.user.lastName} is leaving class ${roomId}`);
      this.addDebugLog(roomId, 'leave-class', {
        userId: socket.user.id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    }
  }

  handleSendMessage(socket, { roomId, message }) {
    console.log(`💬 Message received from ${socket.user?.firstName || 'Unknown'} in room ${roomId}: "${message}"`);
    this.addDebugLog(roomId, 'message-received', {
      userId: socket.user?.id,
      userName: `${socket.user?.firstName} ${socket.user?.lastName}`,
      message: message
    });
    
    if (!roomId || !message) {
      console.log('❌ Missing roomId or message');
      this.addDebugLog(roomId, 'message-failed', {
        reason: 'Missing roomId or message',
        userId: socket.user?.id
      });
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      this.addDebugLog(roomId, 'message-failed', {
        reason: 'Room not found',
        userId: socket.user?.id
      });
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!socket.user) {
      console.log('❌ User not authenticated');
      this.addDebugLog(roomId, 'message-failed', {
        reason: 'User not authenticated',
        userId: socket.user?.id
      });
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    const chatMessage = {
      id: Date.now().toString(),
      message: message,
      from: socket.user,
      timestamp: new Date(),
      type: 'text'
    };
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Store message in chat history
    room.chatHistory = room.chatHistory || [];
    room.chatHistory.push(chatMessage);
    
    console.log(`📤 Broadcasting message to all participants in room ${roomId}`);
    this.addDebugLog(roomId, 'message-broadcast', {
      userId: socket.user.id,
      messageId: chatMessage.id
    });
    
    // Broadcast to all participants in room (including sender)
    this.io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`✅ Message broadcasted successfully`);
  }

  handleWebRTCOffer(socket, data) {
  const { offer, roomId, to } = data;
  
  // Add roomId to the offer data for context
  if (offer && !offer.roomId) {
    offer.roomId = roomId;
  }
  
  this.addDebugLog(roomId, 'webrtc-offer', {
    from: socket.user?.id,
    to: to,
    offerType: offer?.type || 'unknown'
  });
  
  if (!offer || !offer.type) {
    console.log('❌ Invalid offer data');
    this.addDebugLog(roomId, 'webrtc-offer-failed', {
      reason: 'Invalid offer data',
      from: socket.user?.id
    });
    socket.emit('webrtc-error', { 
      type: 'invalid-offer',
      message: 'Invalid offer data',
      to: to,
      roomId: roomId
    });
    return;
  }
  
  if (!to) {
    console.log('❌ No target specified for offer');
    this.addDebugLog(roomId, 'webrtc-offer-failed', {
      reason: 'No target specified',
      from: socket.user?.id
    });
    socket.emit('webrtc-error', { 
      type: 'no-target',
      message: 'Target user ID required for offer',
      roomId: roomId
    });
    return;
  }
  
  console.log(`🔍 Looking for target user ${to} in room ${roomId}`);
  const targetSocket = this.findSocketByUserId(to, roomId);
  
  if (!targetSocket) {
    console.log(`❌ Target user ${to} not found in room ${roomId}`);
    this.addDebugLog(roomId, 'webrtc-offer-failed', {
      reason: 'Target user not found',
      from: socket.user?.id,
      to: to
    });
    
    // Send specific error back to sender
    socket.emit('webrtc-error', {
      type: 'target-not-found',
      message: `Target user ${to} not found in room`,
      to: to,
      roomId: roomId
    });
    
    return;
  }
  
  // Check for potential signaling collision using polite/impolite pattern
  const fromUserId = socket.user?.id;
  const isPoliteOffer = fromUserId < to; // Lower ID is polite
  
  this.addDebugLog(roomId, 'webrtc-offer-collision-check', {
    from: fromUserId,
    to: to,
    isPoliteOffer: isPoliteOffer
  });
  
  console.log(`📤 Forwarding offer from ${fromUserId} to ${to} (polite: ${isPoliteOffer})`);
  targetSocket.emit('offer', {
    from: fromUserId,
    offer: offer,
    roomId: roomId,
    isPoliteOffer: isPoliteOffer // Add collision resolution hint
  });

  // Update room activity
  const room = this.liveClasses.get(roomId);
  if (room) {
    room.lastActivity = Date.now();
  }
  
  this.addDebugLog(roomId, 'webrtc-offer-forwarded', {
    from: fromUserId,
    to: to,
    isPoliteOffer: isPoliteOffer
  });
}

  handleWebRTCAnswer(socket, data) {  
  const { answer, roomId, to } = data;
  
  this.addDebugLog(roomId, 'webrtc-answer', {
    from: socket.user?.id,
    to: to,
    answerType: answer?.type || 'unknown'
  });
  
  if (!answer || !answer.type) {
    console.log('❌ Invalid answer data');
    this.addDebugLog(roomId, 'webrtc-answer-failed', {
      reason: 'Invalid answer data',
      from: socket.user?.id
    });
    socket.emit('webrtc-error', {
      type: 'invalid-answer',
      message: 'Invalid answer data',
      to: to,
      roomId: roomId
    });
    return;
  }
  
  console.log(`📤 FORWARDING ANSWER from ${socket.user?.id} to ${to} in ${roomId}`);
  
  if (!to) {
    console.log('❌ No target specified for answer');
    this.addDebugLog(roomId, 'webrtc-answer-failed', {
      reason: 'No target specified',
      from: socket.user?.id
    });
    socket.emit('webrtc-error', {
      type: 'no-target',
      message: 'Target user ID required for answer',
      roomId: roomId
    });
    return;
  }
  
  const targetSocket = this.findSocketByUserId(to, roomId);
  if (targetSocket) {
    targetSocket.emit('answer', {
      from: socket.user?.id,
      answer: answer,
      roomId: roomId
    });
    console.log(`✅ Answer sent to ${to}`);
    this.addDebugLog(roomId, 'webrtc-answer-forwarded', {
      from: socket.user?.id,
      to: to
    });
  } else {
    console.log(`❌ Target socket not found for user ${to}`);
    this.addDebugLog(roomId, 'webrtc-answer-failed', {
      reason: 'Target socket not found',
      from: socket.user?.id,
      to: to
    });
    
    // Notify sender about the failure
    socket.emit('webrtc-error', {
      type: 'target-not-found',
      message: `Failed to send answer to user ${to}`,
      to: to,
      roomId: roomId
    });
  }

  // Update room activity
  const room = this.liveClasses.get(roomId);
  if (room) {
    room.lastActivity = Date.now();
  }
}


  handleWebRTCIceCandidate(socket, data) {
  const { candidate, roomId, to } = data;
  
  this.addDebugLog(roomId, 'webrtc-ice-candidate', {
    from: socket.user?.id,
    to: to,
    candidate: candidate ? candidate.candidate : 'null'
  });
  
  // Skip null/empty candidates (this is correct)
  if (!candidate || !candidate.candidate) {
    this.addDebugLog(roomId, 'webrtc-ice-skipped', {
      reason: 'Null candidate',
      from: socket.user?.id,
      to: to
    });
    return;
  }
  
  // Extract candidate string safely
  const candidateStr = typeof candidate.candidate === 'string' 
    ? candidate.candidate 
    : String(candidate.candidate);
  
  // Determine candidate type for logging (but don't filter)
  let candidateType = 'host';
  if (candidateStr.includes('typ srflx')) candidateType = 'srflx';
  if (candidateStr.includes('typ relay')) candidateType = 'relay';
  if (candidateStr.includes('typ prflx')) candidateType = 'prflx';
  
  // Track candidate type for diagnostics
  this.trackCandidateType(socket.user?.id, candidateType);
  
  // Log but don't filter - WebRTC needs multiple candidate types for fallback
  this.addDebugLog(roomId, 'webrtc-ice-candidate-type', {
    from: socket.user?.id,
    candidateType: candidateType,
    hasBetter: this.hasBetterCandidateType(socket.user?.id, candidateType)
  });
  
  console.log(`📤 FORWARDING ICE from ${socket.user?.id} to ${to} in ${roomId}`);
  
  if (!to) {
    console.log('❌ No target specified for ICE candidate');
    this.addDebugLog(roomId, 'webrtc-ice-failed', {
      reason: 'No target specified',
      from: socket.user?.id
    });
    return;
  }
  
  const targetSocket = this.findSocketByUserId(to, roomId);
  if (targetSocket) {
    targetSocket.emit('ice-candidate', {
      from: socket.user?.id,
      candidate: candidate,
      roomId: roomId // Add roomId for context
    });
    this.addDebugLog(roomId, 'webrtc-ice-forwarded', {
      from: socket.user?.id,
      to: to
    });
  } else {
    console.log(`❌ Target socket not found for user ${to}`);
    this.addDebugLog(roomId, 'webrtc-ice-failed', {
      reason: 'Target socket not found',
      from: socket.user?.id,
      to: to
    });
    
    // Notify sender about the failure
    socket.emit('webrtc-error', {
      type: 'ice-candidate-failed',
      message: `Failed to send ICE candidate to user ${to}`,
      to: to
    });
  }

  // Update room activity
  const room = this.liveClasses.get(roomId);
  if (room) {
    room.lastActivity = Date.now();
  }
}

  handleDisconnect(socket) {
    const roomId = socket.roomId;
    
    if (roomId && socket.user) {
      const room = this.liveClasses.get(roomId);
      if (room && room.participants.has(socket.user.id)) {
        const participant = room.participants.get(socket.user.id);
        room.participants.delete(socket.user.id);
        room.lastActivity = Date.now();
        
        // Clean up candidate tracking
        this.candidateTypes.delete(socket.user.id);
        
        // Notify other participants
        socket.to(roomId).emit('participant-left', {
          userId: socket.user.id,
          user: socket.user
        });
        
        console.log(`User ${socket.user.firstName} ${socket.user.lastName} left room ${roomId}`);
        console.log(`📊 Room ${roomId} now has ${room.participants.size} participants`);
        
        this.addDebugLog(roomId, 'participant-left', {
          userId: socket.user.id,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          remainingParticipants: room.participants.size
        });
        
        // Clean up empty rooms immediately
        if (room.participants.size === 0) {
          console.log(`🧹 Cleaning up empty room: ${roomId}`);
          this.liveClasses.delete(roomId);
          this.whiteboardData.delete(roomId);
          this.debugLogs.delete(roomId);
        }
      }
    }

    this.connectedUsers.delete(socket.id);
    console.log(`Socket disconnected: ${socket.id}`);
  }

  // Helper methods
  getRoomParticipants(roomId) {
    const room = this.liveClasses.get(roomId);
    return room ? Array.from(room.participants.values()) : [];
  }

  getRoomInstructor(roomId) {
    const room = this.liveClasses.get(roomId);
    return room?.instructor ? room.participants.get(room.instructor) : null;
  }

  isUserInRoom(socketId, roomId) {
    const room = this.liveClasses.get(roomId);
    return room ? room.participants.has(socketId) : false;
  }

  // Debug method
  debugRoom(roomId) { 
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      return;
    }
    
    console.log(`🔍 DEBUG: Room ${roomId} connections:`);
    console.log(`👥 Participants: ${room.participants.size}`);
    console.log(`🕐 Created: ${new Date(room.createdAt).toISOString()}`);
    console.log(`🕐 Last activity: ${new Date(room.lastActivity).toISOString()}`);
    
    Array.from(room.participants.values()).forEach(participant => {
      const socket = this.io.sockets.sockets.get(participant.socketId);
      console.log(`   - ${participant.user.firstName} ${participant.user.lastName}:`);
      console.log(`     User ID: ${participant.userId.toString()}`);
      console.log(`     Socket ID: ${participant.socketId}`);
      console.log(`     Socket Connected: ${!!socket}`);
      console.log(`     Socket Authenticated: ${socket?.authenticated}`);
    });
  }

  // Find socket by user ID
  findSocketByUserId(userId, roomId) {
    // Get the room
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log('❌ Room not found');
      return null;
    }
    
    // Convert userId to string for comparison
    const targetUserIdStr = userId.toString();
    
    // Find the participant by user ID
    const participant = Array.from(room.participants.values()).find(
      p => p.userId.toString() === targetUserIdStr
    );
    
    if (!participant) {
      console.log('❌ Participant not found in room participants');
      return null;
    }
    
    // Find the socket by socket ID
    const socket = this.io.sockets.sockets.get(participant.socketId);
    
    if (!socket) {
      console.log('❌ Socket not found for participant');
      return null;
    }
    
    return socket;
  }
}

module.exports = EnhancedSocketHandler;