// newSocketHandler.js
class SocketHandler {
  constructor(io) {
    this.io = io;
    this.rooms = {};
    this.liveClasses = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      // Use the enhanced join-class handler instead of simple join
      socket.on("join", (data) => {
        this.handleJoinClass(socket, data);
      });

      socket.on("signal", ({ target, signal }) => {
        console.log(`Signal from ${socket.id} -> ${target}`);
        this.io.to(target).emit("signal", { from: socket.id, signal });
      });

      // Hand raising
      socket.on('raise-hand', (data) => {
        this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', (data) => {
        this.handleLowerHand(socket, data);
      });

      // Chat
      socket.on('send-message', (message) => {
        this.handleSendMessage(socket, message);
      });

      // Screen sharing events - simplified

      socket.on('start-screen-share', (data) => {
        this.handleStartScreenShare(socket, data);
      });

      socket.on('stop-screen-share', (data) => {
        this.handleStopScreenShare(socket, data);
      });

      // Instructor actions
      socket.on('instructor-action', (data) => {
        this.handleInstructorAction(socket, data);
      });

      socket.on("leave", ({ roomId }) => {
        this.handleLeave(socket, roomId);
      });

      socket.on("toggle-video", ({ roomId, camOn }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) {
          console.log(`❌ Room ${roomId} not found for video toggle`);
          return;
        }

        const userId = room.socketToUserId.get(socket.id);
        if (!userId || !room.participants.has(userId)) {
          console.log(`❌ User not found in room ${roomId}`);
          return;
        }

        const participant = room.participants.get(userId);

        // ✅ Update backend state
        participant.isVideoEnabled = camOn;
        room.lastActivity = Date.now();

        console.log(
          `📷 ${participant.user.firstName} ${participant.user.lastName} video ${
            camOn ? "enabled" : "disabled"
          } in room ${roomId}`
        );

        // ✅ Notify everyone else
        socket.to(roomId).emit("participant-video-toggled", {
          userId: userId,
          camOn: camOn
        });
      });


      // Audio events handlers
      socket.on("speaking-level", ({ roomId, level }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) return;
        const userId = room.socketToUserId.get(socket.id)
        if (!userId) return;

        socket.to(roomId).emit("participant-speaking-level", {
          userId,
          level
        })
      })



      socket.on("speaking-stopped", ({ roomId }) => {
        const room = this.liveClasses.get(roomId)
        if (!room) return

        const userId = room.socketToUserId.get(socket.id)
        if (!userId) return

        socket.to(roomId).emit("participant-speaking", {
          userId,
          speaking: false
        })
      })


      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Prefer explicit room id when available.
        if (socket.roomId && this.liveClasses.has(socket.roomId)) {
          this.handleLeave(socket, socket.roomId);
          return;
        }

        // Fallback: scan live room mappings.
        for (const [roomId, room] of this.liveClasses.entries()) {
          if (room.socketToUserId.has(socket.id)) {
            this.handleLeave(socket, roomId);
            break;
          }
        }
      });
    });
  }

   handleJoinClass(socket, { roomId, classId, user }) {
    console.log(`🚪 User ${user.firstName} ${user.lastName} attempting to join class ${roomId}`);
    
    try {
      // Validate data
      if (!roomId || !user) {
        console.log('❌ Missing roomId or user data');
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
          participants: new Map(), // Only store by userId
          socketToUserId: new Map(), // Map socketId to userId for lookups
          instructor: null,
          whiteboardData: [],
          chatHistory: [],
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
      }

      const room = this.liveClasses.get(roomId);
      const isInstructor = authenticatedUser?.roleId?.name === 'INSTRUCTOR' || authenticatedUser?.role?.name === 'INSTRUCTOR' || authenticatedUser?.role === 'instructor';
      
      // Check if user is already in the room with a different socket (page reload case)
      const existingParticipant = room.participants.get(authenticatedUser.id);
      if (existingParticipant) {
        console.log(`🔄 User ${authenticatedUser.firstName} ${authenticatedUser.lastName} rejoining (page reload detected)`);
        
        // Clean up old socket mapping
        const oldSocketId = existingParticipant.socketId;
        room.socketToUserId.delete(oldSocketId);
        
        // Notify others to remove old peer connection
        socket.to(roomId).emit('peer-left', { 
          peerId: oldSocketId, 
          userId: authenticatedUser.id 
        });
        
        // Update with new socket information
        existingParticipant.socketId = socket.id;
        existingParticipant.joinedAt = new Date();
        room.socketToUserId.set(socket.id, authenticatedUser.id);
        
        console.log(`🔄 Updated existing participant with new socket ${socket.id}`);
      } else {
        // Add new participant to room using userId as key
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

        // Store participant with userId key and map socketId to userId
        room.participants.set(authenticatedUser.id, participant);
        room.socketToUserId.set(socket.id, authenticatedUser.id);
        
        console.log(`✅ New participant added to room. Total participants: ${room.participants.size}`);
      }
      
      room.lastActivity = Date.now();

      // Set instructor
      if (isInstructor) {
        room.instructor = socket.id;
        socket.isInstructor = true;
        console.log(`👨‍🏫 Instructor role assigned`);
      }

      // Get existing participants (excluding the current user)
      const existingParticipants = Array.from(room.participants.values())
        .filter(p => p.userId !== authenticatedUser.id);

      console.log(`📤 Notifying ${existingParticipants.length} existing participants about user join`);
      
      // Notify existing participants about user (re)joining
      socket.to(roomId).emit('participant-joined', {
        userId: authenticatedUser.id,
        user: authenticatedUser,
        socketId: socket.id
      });

      console.log(`📥 Sending room data to user`);
      
      // Send existing participants to user and confirm join
      socket.emit('class-joined', {
        participants: existingParticipants,
        chatHistory: room.chatHistory || []
      });

      console.log(`✅ ${authenticatedUser.firstName} ${authenticatedUser.lastName} successfully ${existingParticipant ? 'rejoined' : 'joined'} ${roomId} as ${isInstructor ? 'instructor' : 'student'}`);
      console.log(`📊 Room ${roomId} now has ${room.participants.size} participants`);

    } catch (error) {
      console.error('❌ Error joining class:', error);
      socket.emit('error', { message: 'Failed to join class: ' + error.message });
    }
  }


  

  handleRaiseHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for hand raise`);
      return;
    }

    // Get user info from room participants
    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) {
      console.log(`❌ User not found in room ${roomId} participants`);
      return;
    }

    const participant = room.participants.get(userId);
    participant.isHandRaised = true;
    room.lastActivity = Date.now();
    
    // Broadcast update to all participants in room
    this.io.to(roomId).emit('hand-raised', {
      userId: userId,
      user: participant.user
    });
    
    console.log(`✋ ${participant.user.firstName} ${participant.user.lastName} raised hand in room ${roomId}`);
  }

  handleLowerHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for hand lower`);
      return;
    }

    // Get user info from room participants
    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) {
      console.log(`❌ User not found in room ${roomId} participants`);
      return;
    }

    const participant = room.participants.get(userId);
    participant.isHandRaised = false;
    room.lastActivity = Date.now();
    
    // Broadcast update to all participants in room
    this.io.to(roomId).emit('hand-lowered', {
      userId: userId,
      user: participant.user
    });
    
    console.log(`👇 ${participant.user.firstName} ${participant.user.lastName} lowered hand in room ${roomId}`);
  }

  handleSendMessage(socket, { roomId, message }) {
    console.log(`💬 Message received in room ${roomId}: "${message}"`);
    
    if (!roomId || !message) {
      console.log('❌ Missing roomId or message');
      return;
    }

    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Get user info from room participants using socket.id
    const userId = room.socketToUserId.get(socket.id);
    let userInfo = null;
    
    if (userId) {
      const participant = room.participants.get(userId);
      if (participant) {
        userInfo = participant.user;
      }
    }

    // Fallback to socket.user if available
    if (!userInfo && socket.user) {
      userInfo = socket.user;
    }

    if (!userInfo) {
      console.log('❌ User not found in room participants');
      socket.emit('error', { message: 'User not authenticated or not in room' });
      return;
    }

    console.log(`💬 Message from ${userInfo.firstName} ${userInfo.lastName}`);

    const chatMessage = {
      id: Date.now().toString(),
      message: message.trim(),
      from: userInfo,
      timestamp: new Date(),
      type: 'text'
    };
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Store message in chat history
    room.chatHistory = room.chatHistory || [];
    room.chatHistory.push(chatMessage);
    
    // Keep only last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }
    
    console.log(`📤 Broadcasting message to all participants in room ${roomId}`);
    
    // Broadcast to all participants in room (including sender)
    this.io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`✅ Message broadcasted successfully`);
  }

  handleLeave(socket, roomId) {
    console.log(`${socket.id} leaving room ${roomId}`);
    
    // Initialize rooms object if doesn't exist
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = new Set();
    }
    
    // Remove from WebRTC rooms
    if (this.rooms[roomId].has(socket.id)) {
      this.rooms[roomId].delete(socket.id);
    }
    
    // Remove from participants list and get user info
    const room = this.liveClasses.get(roomId);
    let userId = null;
    let userName = 'Unknown User';
    
    if (room) {
      userId = room.socketToUserId.get(socket.id);
      if (userId) {
        const participant = room.participants.get(userId);
        if (participant) {
          userName = `${participant.user.firstName} ${participant.user.lastName}`;
        }
        
        // Remove participant and socket mapping
        room.participants.delete(userId);
        room.socketToUserId.delete(socket.id);
        room.lastActivity = Date.now();
        
        console.log(`✅ Removed ${userName} (${userId}) from room ${roomId}. Remaining: ${room.participants.size}`);
      }
    }
    
    // Notify others that this user left (send both peer-left and participant-left)
    if (userId) {
      socket.to(roomId).emit('peer-left', { 
        peerId: socket.id, 
        userId: userId 
      });
      socket.to(roomId).emit('participant-left', { 
        userId: userId, 
        socketId: socket.id 
      });
      
      console.log(`📤 Notified room ${roomId} that ${userName} left`);
    }
    
    socket.leave(roomId);
  }

  // Screen sharing methods - simplified (removed request/approval logic)

  handleStartScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for start screen share`);
      return;
    }

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) {
      console.log(`❌ User not found in room ${roomId} participants`);
      return;
    }

    const participant = room.participants.get(userId);
    participant.isScreenSharing = true;
    room.lastActivity = Date.now();

    console.log(`🖥️ ${participant.user.firstName} ${participant.user.lastName} started screen sharing in room ${roomId}`);

    // Notify all other participants
    socket.to(roomId).emit('screen-share-started', {
      userId: userId,
      socketId: socket.id,
      user: participant.user
    });
  }

  handleStopScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for stop screen share`);
      return;
    }

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) {
      console.log(`❌ User not found in room ${roomId} participants`);
      return;
    }

    const participant = room.participants.get(userId);
    participant.isScreenSharing = false;
    room.lastActivity = Date.now();

    console.log(`🛑 ${participant.user.firstName} ${participant.user.lastName} stopped screen sharing in room ${roomId}`);

    // Notify all other participants
    socket.to(roomId).emit('screen-share-stopped', {
      userId: userId,
      socketId: socket.id,
      user: participant.user
    });
  }

  // Instructor action handler
  handleInstructorAction(socket, { roomId, action, targetUserId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found for instructor action`);
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    // Verify the socket user is an instructor
    const instructorUserId = room.socketToUserId.get(socket.id);
    if (!instructorUserId || !room.participants.has(instructorUserId)) {
      console.log(`❌ Instructor not found in room ${roomId}`);
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    const instructor = room.participants.get(instructorUserId);
    console.log(instructor, "instructor Objectt")
    if (!instructor.isInstructor) {
      console.log(`❌ User ${instructorUserId} is not an instructor`);
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    // Find target participant
    const targetParticipant = room.participants.get(targetUserId);
    if (!targetParticipant) {
      console.log(`❌ Target participant ${targetUserId} not found`);
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    // Don't allow instructors to target other instructors
    if (targetParticipant.isInstructor) {
      console.log(`❌ Cannot perform action on another instructor`);
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    console.log(`👨‍🏫 Instructor ${instructor.user.firstName} ${instructor.user.lastName} performing ${action} on ${targetParticipant.user.firstName} ${targetParticipant.user.lastName}`);

    let success = true;
    
    try {
      switch (action) {
        case 'disconnect':
          // Notify the target user they're being disconnected
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'disconnect',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          
          console.log(`🔌 Force disconnecting ${targetParticipant.user.firstName} ${targetParticipant.user.lastName} (${targetParticipant.socketId})`);
          
          // Manually clean up and notify other participants immediately
          const targetSocketId = targetParticipant.socketId;
          const targetUserId = targetParticipant.userId;
          
          // Clean up from room data structures
          if (room.participants.has(targetUserId)) {
            room.participants.delete(targetUserId);
            room.socketToUserId.delete(targetSocketId);
            room.lastActivity = Date.now();
            
            console.log(`🧹 Cleaned up participant ${targetUserId} from room ${roomId}`);
          }
          
          // Clean up from WebRTC rooms
          if (this.rooms[roomId] && this.rooms[roomId].has(targetSocketId)) {
            this.rooms[roomId].delete(targetSocketId);
          }
          
          // Notify all OTHER participants that this user left
          socket.to(roomId).emit('peer-left', { 
            peerId: targetSocketId, 
            userId: targetUserId 
          });
          socket.to(roomId).emit('participant-left', { 
            userId: targetUserId, 
            socketId: targetSocketId 
          });
          
          console.log(`📤 Notified room ${roomId} about forced disconnect of ${targetParticipant.user.firstName}`);
          
          // Force disconnect the target socket after a brief delay
          setTimeout(() => {
            const targetSocket = this.io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
              console.log(`💀 Forcibly disconnecting socket ${targetSocketId}`);
              targetSocket.disconnect(true);
            }
          }, 1000); // Reduced delay since we already cleaned up
          break;

        case 'mute':
          // Notify the target user to mute
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'mute',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          break;

        case 'unmute':
          // Notify the target user to unmute
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'unmute',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          break;

        case 'disable-video':
          // Notify the target user to disable video
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'disable-video',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          break;

        case 'enable-video':
          // Notify the target user to enable video
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'enable-video',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          break;

        case 'stop-screen-share':
          // Stop the target user's screen sharing
          targetParticipant.isScreenSharing = false;
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'stop-screen-share',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });
          
          // Notify all participants that screen sharing stopped
          this.io.to(roomId).emit('screen-share-stopped', {
            userId: targetUserId,
            socketId: targetParticipant.socketId,
            user: targetParticipant.user
          });
          break;

        default:
          success = false;
          console.log(`❌ Unknown instructor action: ${action}`);
      }
    } catch (error) {
      console.error(`❌ Error performing instructor action ${action}:`, error);
      success = false;
    }

    // Confirm action completion to instructor
    socket.emit('instructor-action-performed', { 
      action, 
      targetUserId, 
      success 
    });

    room.lastActivity = Date.now();
  }
}

module.exports = SocketHandler;
