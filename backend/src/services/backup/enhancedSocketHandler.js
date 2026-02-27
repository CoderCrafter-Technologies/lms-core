/**
 * Enhanced Socket.IO handler for live classroom features
 * Fixed version with proper WebRTC signaling, media streaming, and participant management
 */

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
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    console.log('📡 Setting up Socket.IO event handlers...');
    
    this.io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      // Enhanced debug logging for all events
      socket.onAny((eventName, ...args) => {
        if (!eventName.includes('heartbeat') && !eventName.includes('ping')) {
          console.log(`📥 Event received: ${eventName}`, {
            socketId: socket.id,
            userId: socket.user?.id,
            argsCount: args.length
          });
        }
      });

      // Authentication handler
      socket.on('authenticate', async (data) => {
        try {
          console.log(`🔐 Authentication attempt for socket: ${socket.id}`);
          const { token } = data;
          
          if (!token) {
            console.log('❌ No token provided');
            socket.emit('authentication-failed', { message: 'No token provided' });
            return;
          }

          const decoded = jwt.verify(token, config.jwtSecret);
          console.log('✅ Token decoded successfully:', { userId: decoded.userId });

          const user = await userRepository.findById(decoded.userId, {
            populate: { path: 'roleId', select: 'name' }
          });

          if (user) {
            socket.user = user;
            socket.authenticated = true;
            this.connectedUsers.set(socket.id, {
              socketId: socket.id,
              user: user,
              connectedAt: new Date()
            });

            socket.emit('authenticated', { success: true, user: user });
            console.log(`✅ User authenticated: ${user.firstName} ${user.lastName} (${user.roleId?.name || 'No role'})`);
          } else {
            console.log('❌ User not found in database');
            socket.emit('authentication-failed', { message: 'User not found' });
          }
        } catch (error) {
          console.error('❌ Authentication error:', error.message);
          socket.emit('authentication-failed', { message: 'Invalid token' });
        }
      });

      // Join classroom handler - Enhanced
      socket.on('join-class', (data) => {
        console.log(`🚪 Join class request from ${socket.user?.firstName || 'Unknown'}:`, data);
        
        if (!socket.authenticated) {
          console.log('❌ Authentication required for join-class');
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        this.handleJoinClass(socket, data);
      });

      // WebRTC signaling handlers - Enhanced
      socket.on('offer', (data) => {
        console.log(`📤 Offer relay: ${socket.user?.id} -> ${data.to}`);
        this.handleWebRTCOffer(socket, data);
      });

      socket.on('answer', (data) => {
        console.log(`📤 Answer relay: ${socket.user?.id} -> ${data.to}`);
        this.handleWebRTCAnswer(socket, data);
      });

      socket.on('ice-candidate', (data) => {
        console.log(`📤 ICE candidate relay: ${socket.user?.id} -> ${data.to}`);
        this.handleWebRTCIceCandidate(socket, data);
      });

      // Media control handlers
      socket.on('start-screen-share', (data) => {
        this.handleStartScreenShare(socket, data);
      });

      socket.on('stop-screen-share', (data) => {
        this.handleStopScreenShare(socket, data);
      });

      // Hand raising handlers
      socket.on('raise-hand', (data) => {
        this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', (data) => {
        this.handleLowerHand(socket, data);
      });

      // Chat handlers
      socket.on('send-message', (data) => {
        this.handleSendMessage(socket, data);
      });

      // Leave class handler
      socket.on('leave-class', (data) => {
        this.handleLeaveClass(socket, data);
      });

      // Whiteboard handlers
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

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Connection monitoring
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  handleJoinClass(socket, { roomId, classId, user }) {
    console.log(`🚪 Processing join class request:`, {
      roomId,
      classId,
      userId: user?.id || socket.user?.id,
      socketId: socket.id
    });

    try {
      // Validate required data
      if (!roomId || !socket.user) {
        console.log('❌ Missing required data for joining class');
        socket.emit('error', { message: 'Missing required data for joining class' });
        return;
      }

      // Use authenticated user from socket
      const authenticatedUser = socket.user;
      const isInstructor = authenticatedUser?.roleId?.name === 'INSTRUCTOR' || authenticatedUser?.role === 'instructor';

      console.log(`👤 User joining: ${authenticatedUser.firstName} ${authenticatedUser.lastName} (${isInstructor ? 'Instructor' : 'Student'})`);

      // Join socket to room
      socket.join(roomId);
      socket.roomId = roomId;
      socket.classId = classId;

      // Initialize room if it doesn't exist
      if (!this.liveClasses.has(roomId)) {
        console.log(`🏠 Creating new room: ${roomId}`);
        this.liveClasses.set(roomId, {
          participants: new Map(),
          instructor: null,
          whiteboardData: [],
          chatHistory: [],
          createdAt: new Date()
        });
      }

      const room = this.liveClasses.get(roomId);

      // Create participant object
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

      // Add participant to room
      room.participants.set(authenticatedUser.id, participant);
      
      console.log(`✅ Participant added to room ${roomId}. Total participants: ${room.participants.size}`);

      // Set instructor if applicable
      if (isInstructor && !room.instructor) {
        room.instructor = socket.id;
        socket.isInstructor = true;
        console.log(`👨‍🏫 Instructor role assigned to ${authenticatedUser.firstName}`);
      }

      // Get existing participants (excluding current user)
      const existingParticipants = Array.from(room.participants.values())
        .filter(p => p.userId !== authenticatedUser.id)
        .map(p => ({
          userId: p.userId,
          user: p.user,
          isHandRaised: p.isHandRaised,
          isScreenSharing: p.isScreenSharing
        }));

      console.log(`📤 Notifying ${existingParticipants.length} existing participants about new user`);

      // Notify existing participants about new user
      socket.to(roomId).emit('participant-joined', {
        userId: authenticatedUser.id,
        user: authenticatedUser,
        isHandRaised: false
      });

      // Send room state to new user
      console.log(`📥 Sending room data to new user`);
      socket.emit('class-joined', {
        success: true,
        roomId: roomId,
        participants: existingParticipants,
        chatHistory: room.chatHistory || [],
        whiteboardData: room.whiteboardData || []
      });

      console.log(`✅ ${authenticatedUser.firstName} ${authenticatedUser.lastName} successfully joined ${roomId}`);
      console.log(`📊 Room ${roomId} now has ${room.participants.size} participant(s)`);

    } catch (error) {
      console.error('❌ Error in handleJoinClass:', error);
      socket.emit('error', { message: 'Failed to join class: ' + error.message });
    }
  }

  handleWebRTCOffer(socket, data) {
    const { offer, roomId, to, from } = data;
    
    console.log(`📡 Handling WebRTC offer:`, {
      from: from || socket.user?.id,
      to: to,
      roomId: roomId,
      hasOffer: !!offer
    });

    if (!to) {
      console.log('❌ No target specified for offer');
      socket.emit('error', { message: 'Target user ID required for offer' });
      return;
    }

    const targetSocket = this.findSocketByUserId(to, roomId);
    if (!targetSocket) {
      console.log(`❌ Target user ${to} not found in room ${roomId}`);
      socket.emit('error', { message: `User ${to} not found in room` });
      return;
    }

    console.log(`📤 Forwarding offer from ${socket.user?.id} to ${to}`);
    targetSocket.emit('offer', {
      from: socket.user?.id,
      offer: offer,
      roomId: roomId
    });

    console.log(`✅ Offer successfully forwarded to ${to}`);
  }

  handleWebRTCAnswer(socket, data) {
    const { answer, roomId, to, from } = data;
    
    console.log(`📡 Handling WebRTC answer:`, {
      from: from || socket.user?.id,
      to: to,
      roomId: roomId,
      hasAnswer: !!answer
    });

    if (!to) {
      console.log('❌ No target specified for answer');
      return;
    }

    const targetSocket = this.findSocketByUserId(to, roomId);
    if (!targetSocket) {
      console.log(`❌ Target user ${to} not found in room ${roomId}`);
      return;
    }

    console.log(`📤 Forwarding answer from ${socket.user?.id} to ${to}`);
    targetSocket.emit('answer', {
      from: socket.user?.id,
      answer: answer,
      roomId: roomId
    });

    console.log(`✅ Answer successfully forwarded to ${to}`);
  }

  handleWebRTCIceCandidate(socket, data) {
    const { candidate, roomId, to, from } = data;
    
    console.log(`📡 Handling ICE candidate:`, {
      from: from || socket.user?.id,
      to: to,
      roomId: roomId,
      hasCandidate: !!candidate
    });

    if (!to) {
      console.log('❌ No target specified for ICE candidate');
      return;
    }

    const targetSocket = this.findSocketByUserId(to, roomId);
    if (!targetSocket) {
      console.log(`❌ Target user ${to} not found in room ${roomId}`);
      return;
    }

    console.log(`📤 Forwarding ICE candidate from ${socket.user?.id} to ${to}`);
    targetSocket.emit('ice-candidate', {
      from: socket.user?.id,
      candidate: candidate,
      roomId: roomId
    });

    console.log(`✅ ICE candidate successfully forwarded to ${to}`);
  }

  handleStartScreenShare(socket, { roomId }) {
    console.log(`🖥️ Start screen share request from ${socket.user?.firstName} in room ${roomId}`);
    
    if (!roomId || !socket.user) {
      console.log('❌ Missing roomId or user data for screen share');
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room || !room.participants.has(socket.user.id)) {
      console.log('❌ User not found in room for screen share');
      return;
    }

    const participant = room.participants.get(socket.user.id);
    participant.isScreenSharing = true;

    // Broadcast to all participants in room except sender
    socket.to(roomId).emit('screen-share-started', {
      userId: socket.user.id,
      user: socket.user
    });

    console.log(`✅ ${socket.user.firstName} started screen sharing in room ${roomId}`);
  }

  handleStopScreenShare(socket, { roomId }) {
    console.log(`🖥️ Stop screen share request from ${socket.user?.firstName} in room ${roomId}`);
    
    if (!roomId || !socket.user) {
      console.log('❌ Missing roomId or user data for screen share');
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room || !room.participants.has(socket.user.id)) {
      console.log('❌ User not found in room for screen share');
      return;
    }

    const participant = room.participants.get(socket.user.id);
    participant.isScreenSharing = false;

    // Broadcast to all participants in room except sender
    socket.to(roomId).emit('screen-share-stopped', {
      userId: socket.user.id,
      user: socket.user
    });

    console.log(`✅ ${socket.user.firstName} stopped screen sharing in room ${roomId}`);
  }

  handleRaiseHand(socket, { roomId }) {
    console.log(`✋ Raise hand request from ${socket.user?.firstName} in room ${roomId}`);
    
    if (!roomId || !socket.user) {
      console.log('❌ Missing roomId or user data for hand raise');
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room || !room.participants.has(socket.user.id)) {
      console.log('❌ User not found in room for hand raise');
      return;
    }

    const participant = room.participants.get(socket.user.id);
    participant.isHandRaised = true;

    // Broadcast to all participants in room
    this.io.to(roomId).emit('hand-raised', {
      userId: socket.user.id,
      user: socket.user
    });

    console.log(`✅ ${socket.user.firstName} raised hand in room ${roomId}`);
  }

  handleLowerHand(socket, { roomId }) {
    console.log(`✋ Lower hand request from ${socket.user?.firstName} in room ${roomId}`);
    
    if (!roomId || !socket.user) {
      console.log('❌ Missing roomId or user data for hand lower');
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room || !room.participants.has(socket.user.id)) {
      console.log('❌ User not found in room for hand lower');
      return;
    }

    const participant = room.participants.get(socket.user.id);
    participant.isHandRaised = false;

    // Broadcast to all participants in room
    this.io.to(roomId).emit('hand-lowered', {
      userId: socket.user.id,
      user: socket.user
    });

    console.log(`✅ ${socket.user.firstName} lowered hand in room ${roomId}`);
  }

  handleSendMessage(socket, { roomId, message }) {
    console.log(`💬 Chat message from ${socket.user?.firstName || 'Unknown'} in room ${roomId}: "${message}"`);
    
    if (!roomId || !message || !socket.user) {
      console.log('❌ Missing required data for chat message');
      socket.emit('error', { message: 'Missing required data for chat message' });
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for chat message`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!room.participants.has(socket.user.id)) {
      console.log(`❌ User not in room ${roomId} for chat message`);
      socket.emit('error', { message: 'User not in room' });
      return;
    }

    const chatMessage = {
      id: Date.now().toString(),
      message: message.trim(),
      from: {
        id: socket.user.id,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName
      },
      timestamp: new Date(),
      type: 'text'
    };

    // Store message in room history
    if (!room.chatHistory) {
      room.chatHistory = [];
    }
    room.chatHistory.push(chatMessage);

    // Keep only last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    console.log(`📤 Broadcasting message to all participants in room ${roomId}`);
    
    // Broadcast to all participants in room (including sender for confirmation)
    this.io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`✅ Chat message broadcasted successfully`);
  }

  handleLeaveClass(socket, { roomId }) {
    console.log(`🚪 Leave class request from ${socket.user?.firstName} for room ${roomId}`);
    
    if (socket.user && roomId) {
      const room = this.liveClasses.get(roomId);
      if (room && room.participants.has(socket.user.id)) {
        // Remove participant
        room.participants.delete(socket.user.id);
        
        // Notify other participants
        socket.to(roomId).emit('participant-left', {
          userId: socket.user.id,
          user: socket.user
        });
        
        console.log(`✅ ${socket.user.firstName} left room ${roomId}`);
        
        // Clean up empty room
        if (room.participants.size === 0) {
          this.liveClasses.delete(roomId);
          this.whiteboardData.delete(roomId);
          console.log(`🧹 Room ${roomId} cleaned up - no participants remaining`);
        }
      }
    }
  }

  handleJoinWhiteboard(socket, roomId) {
    console.log(`📝 Join whiteboard request for room ${roomId}`);
    
    socket.join(`whiteboard-${roomId}`);
    
    // Send existing whiteboard data
    if (this.whiteboardData.has(roomId)) {
      socket.emit('whiteboard-history', this.whiteboardData.get(roomId));
    }
  }

  handleWhiteboardDraw(socket, drawingData) {
    const roomId = socket.roomId;
    if (!roomId) {
      console.log('❌ No roomId for whiteboard draw');
      return;
    }

    console.log(`📝 Whiteboard draw in room ${roomId}`);
    
    // Store drawing data
    if (!this.whiteboardData.has(roomId)) {
      this.whiteboardData.set(roomId, []);
    }

    this.whiteboardData.get(roomId).push(drawingData);

    // Broadcast to all users in the whiteboard room
    socket.to(`whiteboard-${roomId}`).emit('whiteboard-drawing', drawingData);
  }

  handleWhiteboardClear(socket) {
    const roomId = socket.roomId;
    if (!roomId) {
      console.log('❌ No roomId for whiteboard clear');
      return;
    }

    console.log(`📝 Whiteboard clear in room ${roomId}`);
    
    // Clear stored data
    this.whiteboardData.set(roomId, []);

    // Broadcast clear to all users
    this.io.to(`whiteboard-${roomId}`).emit('whiteboard-clear');
  }

  handleWhiteboardUndo(socket, newDrawings) {
    const roomId = socket.roomId;
    if (!roomId) {
      console.log('❌ No roomId for whiteboard undo');
      return;
    }

    console.log(`📝 Whiteboard undo in room ${roomId}`);
    
    // Update stored data
    this.whiteboardData.set(roomId, newDrawings);

    // Broadcast to other users
    socket.to(`whiteboard-${roomId}`).emit('whiteboard-undo', newDrawings);
  }

  handleDisconnect(socket, reason) {
    const roomId = socket.roomId;
    const user = socket.user;
    
    console.log(`🔌 Socket disconnect: ${socket.id}, reason: ${reason}`);
    
    if (user) {
      console.log(`👤 User ${user.firstName} ${user.lastName} disconnected`);
    }

    // Clean up from connected users
    this.connectedUsers.delete(socket.id);

    if (roomId && user) {
      const room = this.liveClasses.get(roomId);
      if (room && room.participants.has(user.id)) {
        // Remove participant
        room.participants.delete(user.id);

        // Notify other participants
        socket.to(roomId).emit('participant-left', {
          userId: user.id,
          user: user,
          reason: reason
        });

        console.log(`📤 Notified room ${roomId} about ${user.firstName} leaving`);

        // Clean up empty room
        if (room.participants.size === 0) {
          this.liveClasses.delete(roomId);
          this.whiteboardData.delete(roomId);
          console.log(`🧹 Room ${roomId} cleaned up - no participants remaining`);
        } else {
          console.log(`📊 Room ${roomId} now has ${room.participants.size} participant(s) remaining`);
        }
      }
    }
  }

  // Helper method to find socket by user ID within a room
  findSocketByUserId(userId, roomId) {
    console.log(`🔍 Finding socket for user ${userId} in room ${roomId}`);
    
    // Get the room
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      return null;
    }

    // Find the participant by user ID
    const participant = room.participants.get(userId);
    if (!participant) {
      console.log(`❌ Participant ${userId} not found in room ${roomId}`);
      console.log(`📊 Available participants:`, Array.from(room.participants.keys()));
      return null;
    }

    console.log(`✅ Found participant:`, {
      userId: participant.userId,
      socketId: participant.socketId,
      name: `${participant.user.firstName} ${participant.user.lastName}`
    });

    // Find the socket by socket ID
    const socket = this.io.sockets.sockets.get(participant.socketId);
    if (!socket) {
      console.log(`❌ Socket ${participant.socketId} not found for user ${userId}`);
      return null;
    }

    console.log(`✅ Found socket ${socket.id} for user ${userId}`);
    return socket;
  }

  // Helper method to get room participants
  getRoomParticipants(roomId) {
    const room = this.liveClasses.get(roomId);
    return room ? Array.from(room.participants.values()) : [];
  }

  // Helper method to get room instructor
  getRoomInstructor(roomId) {
    const room = this.liveClasses.get(roomId);
    if (!room || !room.instructor) return null;
    
    const instructorSocket = this.io.sockets.sockets.get(room.instructor);
    return instructorSocket ? instructorSocket.user : null;
  }

  // Helper method to check if user is in room
  isUserInRoom(userId, roomId) {
    const room = this.liveClasses.get(roomId);
    return room ? room.participants.has(userId) : false;
  }

  // Get statistics for monitoring
  getStatistics() {
    return {
      totalConnectedUsers: this.connectedUsers.size,
      totalActiveRooms: this.liveClasses.size,
      roomsData: Array.from(this.liveClasses.entries()).map(([roomId, room]) => ({
        roomId,
        participantCount: room.participants.size,
        hasInstructor: !!room.instructor,
        createdAt: room.createdAt
      }))
    };
  }
}

module.exports = EnhancedSocketHandler;