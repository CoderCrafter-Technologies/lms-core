/**
 * Socket.IO handler for real-time features
 * Handles WebRTC signaling, live classes, and real-time notifications
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { userRepository } = require('../repositories');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.liveClasses = new Map();
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware for socket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await userRepository.findById(decoded.userId);
        
        if (!user || !user.isActive) {
          return next(new Error('Authentication error: Invalid user'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.email} (${socket.userId})`);
      
      // Store connected user
      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        user: socket.user,
        lastSeen: new Date()
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.email}`);
        this.connectedUsers.delete(socket.userId);
        
        // Remove user from all live classes
        this.liveClasses.forEach((classData, roomId) => {
          if (classData.participants.has(socket.userId)) {
            classData.participants.delete(socket.userId);
            socket.to(roomId).emit('participant-left', {
              userId: socket.userId,
              user: socket.user
            });
          }
        });
      });

      // Live class events
      this.setupLiveClassHandlers(socket);
      
      // WebRTC signaling events
      this.setupWebRTCHandlers(socket);
      
      // General events
      this.setupGeneralHandlers(socket);
    });
  }

  setupLiveClassHandlers(socket) {
    // Join live class
    socket.on('join-class', async (data) => {
      console.log("Joned The class: ", data)
      try {
        const { roomId, classId } = data;
        
        // Validate class access (implement permission check)
        // For now, allow all authenticated users
        
        socket.join(roomId);
        
        // Initialize class data if not exists
        if (!this.liveClasses.has(roomId)) {
          this.liveClasses.set(roomId, {
            classId,
            participants: new Map(),
            instructor: null,
            startTime: new Date(),
            isActive: true
          });
        }

        const classData = this.liveClasses.get(roomId);
        
        // Add participant
        classData.participants.set(socket.userId, {
          user: socket.user,
          joinedAt: new Date(),
          socketId: socket.id
        });

        // Set instructor if user has instructor role
        if (socket.user.roleId.name === 'INSTRUCTOR') {
          classData.instructor = socket.userId;
        }

        // Notify other participants
        socket.to(roomId).emit('participant-joined', {
          userId: socket.userId,
          user: socket.user,
          totalParticipants: classData.participants.size
        });

        // Send current participants to new user
        socket.emit('class-joined', {
          roomId,
          participants: Array.from(classData.participants.values()),
          instructor: classData.instructor
        });

        console.log(`User ${socket.user.email} joined class ${roomId}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to join class' });
      }
    });

    // Leave live class
    socket.on('leave-class', (data) => {
      const { roomId } = data;
      
      socket.leave(roomId);
      
      if (this.liveClasses.has(roomId)) {
        const classData = this.liveClasses.get(roomId);
        classData.participants.delete(socket.userId);
        
        socket.to(roomId).emit('participant-left', {
          userId: socket.userId,
          user: socket.user,
          totalParticipants: classData.participants.size
        });
      }
    });

    // Start class (instructor only)
    socket.on('start-class', (data) => {
      const { roomId } = data;
      
      if (socket.user.roleId.name !== 'INSTRUCTOR') {
        return socket.emit('error', { message: 'Only instructors can start classes' });
      }

      socket.to(roomId).emit('class-started', {
        instructor: socket.user,
        startTime: new Date()
      });
    });

    // End class (instructor only)
    socket.on('end-class', (data) => {
      const { roomId } = data;
      
      if (socket.user.roleId.name !== 'INSTRUCTOR') {
        return socket.emit('error', { message: 'Only instructors can end classes' });
      }

      socket.to(roomId).emit('class-ended', {
        instructor: socket.user,
        endTime: new Date()
      });

      // Clean up class data
      this.liveClasses.delete(roomId);
    });
  }

  setupWebRTCHandlers(socket) {
    // WebRTC signaling for video/audio
    socket.on('offer', (data) => {
      socket.to(data.roomId).emit('offer', {
        offer: data.offer,
        from: socket.userId
      });
    });

    socket.on('answer', (data) => {
      socket.to(data.roomId).emit('answer', {
        answer: data.answer,
        from: socket.userId
      });
    });

    socket.on('ice-candidate', (data) => {
      socket.to(data.roomId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.userId
      });
    });

    // Screen sharing
    socket.on('start-screen-share', (data) => {
      socket.to(data.roomId).emit('screen-share-started', {
        from: socket.userId,
        user: socket.user
      });
    });

    socket.on('stop-screen-share', (data) => {
      socket.to(data.roomId).emit('screen-share-stopped', {
        from: socket.userId
      });
    });
  }

  setupGeneralHandlers(socket) {
    // Chat messages
    socket.on('chat-message', (data) => {
      const { roomId, message } = data;
      
      socket.to(roomId).emit('chat-message', {
        message,
        from: socket.user,
        timestamp: new Date()
      });
    });

    // Whiteboard events
    socket.on('whiteboard-draw', (data) => {
      socket.to(data.roomId).emit('whiteboard-draw', data);
    });

    socket.on('whiteboard-clear', (data) => {
      socket.to(data.roomId).emit('whiteboard-clear', data);
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });


    // Add these to setupGeneralHandlers() in SocketHandler.js
  socket.on('raise-hand', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('hand-raised', {
      userId: socket.userId,
      user: socket.user
    });
  });

  socket.on('lower-hand', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('hand-lowered', {
      userId: socket.userId,
      user: socket.user
    });
  });

  socket.on('create-poll', (data) => {
    const { roomId, poll } = data;
    socket.to(roomId).emit('new-poll', poll);
  });

  socket.on('vote-poll', (data) => {
    const { roomId, pollId, option, userId } = data;
    // You'll need to implement poll voting logic here
    // Then broadcast updated poll:
    socket.to(roomId).emit('poll-vote', updatedPoll);
  });
  }

  // Utility methods
  getUsersInRoom(roomId) {
    const classData = this.liveClasses.get(roomId);
    return classData ? Array.from(classData.participants.values()) : [];
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  notifyUser(userId, event, data) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      this.io.to(user.socketId).emit(event, data);
    }
  }

  broadcastToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }
}

module.exports = (io) => {
  return new SocketHandler(io);
};