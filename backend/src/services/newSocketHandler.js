const LiveClass = require('../models/LiveClass');
const notificationService = require('./notificationService');
const { classifyAttendance, getClassDurationMinutes } = require('./liveClassAttendanceService');
const { resolveLiveClassAccess } = require('./liveClassAccessService');
const { deterministicRoomIdForClass } = require('../utils/liveClassRoomId');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.rooms = {};
    this.liveClasses = new Map();
    this.userSockets = new Map(); // userId -> Set<socketId>
    this.socketToUser = new Map(); // socketId -> userId
    this.setupEventHandlers();
  }

  sanitizeUserId(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null' || lowered === 'nan') return null;
    return normalized;
  }

  normalizeUserId(user = {}, socketUserId = null) {
    return (
      this.sanitizeUserId(socketUserId) ||
      this.sanitizeUserId(user?.id) ||
      this.sanitizeUserId(user?._id) ||
      null
    );
  }

  async resolveCanonicalRoom({ roomId, classId }) {
    const normalizedClassId = classId ? String(classId) : null;

    let liveClass = null;
    if (normalizedClassId) {
      liveClass = await LiveClass.findById(normalizedClassId).select('_id roomId').lean().catch(() => null);
    }

    if (!liveClass && roomId) {
      liveClass = await LiveClass.findOne({ roomId: String(roomId) }).select('_id roomId').lean().catch(() => null);
    }

    if (liveClass?._id && !liveClass.roomId) {
      const fallbackRoomId = deterministicRoomIdForClass(liveClass._id);
      if (fallbackRoomId) {
        await LiveClass.updateOne({ _id: liveClass._id }, { $set: { roomId: fallbackRoomId } }).catch(() => {});
        return fallbackRoomId;
      }
    }

    if (liveClass?.roomId) {
      return String(liveClass.roomId);
    }

    if (normalizedClassId) {
      return deterministicRoomIdForClass(normalizedClassId);
    }

    return roomId ? String(roomId) : null;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      socket.on('register-user', ({ userId }) => {
        this.registerSocketUser(socket, userId);
      });

      socket.on('join', (data) => {
        this.handleJoinClass(socket, data);
      });

      socket.on('signal', ({ target, signal }) => {
        console.log(`Signal from ${socket.id} -> ${target}`);
        this.io.to(target).emit('signal', { from: socket.id, signal });
      });

      socket.on('raise-hand', (data) => {
        this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', (data) => {
        this.handleLowerHand(socket, data);
      });

      socket.on('send-message', (message) => {
        this.handleSendMessage(socket, message);
      });

      socket.on('start-screen-share', (data) => {
        this.handleStartScreenShare(socket, data);
      });

      socket.on('stop-screen-share', (data) => {
        this.handleStopScreenShare(socket, data);
      });

      socket.on('instructor-action', (data) => {
        this.handleInstructorAction(socket, data);
      });

      socket.on('leave', ({ roomId }) => {
        this.handleLeave(socket, roomId);
      });

      socket.on('toggle-video', ({ roomId, camOn }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) {
          console.log(`Room ${roomId} not found for video toggle`);
          return;
        }

        const userId = room.socketToUserId.get(socket.id);
        if (!userId || !room.participants.has(userId)) {
          console.log(`User not found in room ${roomId}`);
          return;
        }

        const participant = room.participants.get(userId);
        participant.isVideoEnabled = camOn;
        room.lastActivity = new Date();

        socket.to(roomId).emit('participant-video-toggled', {
          userId,
          camOn
        });
      });

      socket.on('toggle-audio', ({ roomId, audioOn }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) {
          console.log(`Room ${roomId} not found for audio toggle`);
          return;
        }

        const userId = room.socketToUserId.get(socket.id);
        if (!userId || !room.participants.has(userId)) {
          console.log(`User not found in room ${roomId} for audio toggle`);
          return;
        }

        const participant = room.participants.get(userId);
        participant.isAudioEnabled = Boolean(audioOn);
        room.lastActivity = new Date();

        this.io.to(roomId).emit('participant-audio-toggled', {
          userId,
          audioOn: Boolean(audioOn)
        });
      });

      socket.on('speaking-level', ({ roomId, level }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) return;

        const userId = room.socketToUserId.get(socket.id);
        if (!userId) return;

        socket.to(roomId).emit('participant-speaking-level', {
          userId,
          level
        });
      });

      socket.on('speaking-stopped', ({ roomId }) => {
        const room = this.liveClasses.get(roomId);
        if (!room) return;

        const userId = room.socketToUserId.get(socket.id);
        if (!userId) return;

        socket.to(roomId).emit('participant-speaking', {
          userId,
          speaking: false
        });
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        if (socket.roomId) {
          this.handleLeave(socket, socket.roomId);
        }

        this.unregisterSocket(socket.id);

        for (const [roomId, members] of Object.entries(this.rooms)) {
          if (members.has(socket.id)) {
            this.handleLeave(socket, roomId);
          }
        }
      });
    });
  }

  registerSocketUser(socket, userId) {
    const normalizedUserId = this.sanitizeUserId(userId);
    if (!normalizedUserId) return;
    this.socketToUser.set(socket.id, normalizedUserId);

    if (!this.userSockets.has(normalizedUserId)) {
      this.userSockets.set(normalizedUserId, new Set());
    }
    this.userSockets.get(normalizedUserId).add(socket.id);

    socket.userId = normalizedUserId;
    socket.join(`user:${normalizedUserId}`);
  }

  unregisterSocket(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.socketToUser.delete(socketId);
  }

  emitToUser(userId, event, payload) {
    if (!userId) return;
    this.io.to(`user:${userId.toString()}`).emit(event, payload);
  }

  emitToUsers(userIds = [], event, payload) {
    [...new Set(userIds.filter(Boolean).map((id) => id.toString()))].forEach((userId) => {
      this.emitToUser(userId, event, payload);
    });
  }

  async markAttendanceJoin(roomId, userId) {
    if (!roomId || !userId) return;

    const liveClass = await LiveClass.findOne({ roomId }).select('attendanceRecords').catch(() => null);
    if (!liveClass) return;

    const existingRecord = (liveClass.attendanceRecords || []).find(
      (record) => record.userId?.toString() === userId.toString()
    );

    if (existingRecord) {
      existingRecord.joinedAt = new Date();
      existingRecord.leftAt = null;
    } else {
      liveClass.attendanceRecords.push({
        userId,
        joinedAt: new Date(),
        leftAt: null,
        totalDurationMinutes: 0,
        attendancePercentage: 0,
        status: 'UNKNOWN'
      });
    }

    await liveClass.save().catch(() => {});
  }

  async markAttendanceLeave(roomId, userId) {
    if (!roomId || !userId) return;

    const liveClass = await LiveClass.findOne({ roomId }).select(
      'attendanceRecords scheduledStartTime scheduledEndTime actualStartTime actualEndTime status'
    ).catch(() => null);
    if (!liveClass) return;

    const attendanceRecord = (liveClass.attendanceRecords || []).find(
      (record) => record.userId?.toString() === userId.toString()
    );
    if (!attendanceRecord || !attendanceRecord.joinedAt) return;

    const now = new Date();
    const joinedAt = new Date(attendanceRecord.joinedAt);
    const deltaMinutes = Math.max(0, Math.round((now.getTime() - joinedAt.getTime()) / (1000 * 60)));

    attendanceRecord.totalDurationMinutes = Math.max(attendanceRecord.totalDurationMinutes || 0, 0) + deltaMinutes;
    attendanceRecord.leftAt = now;
    attendanceRecord.joinedAt = null;

    const classDurationMinutes = getClassDurationMinutes(liveClass);
    const cappedMinutes = Math.min(attendanceRecord.totalDurationMinutes, classDurationMinutes);
    const attendancePercentage = Math.min(
      100,
      Math.max(0, Math.round((cappedMinutes / classDurationMinutes) * 100))
    );

    attendanceRecord.totalDurationMinutes = cappedMinutes;
    attendanceRecord.attendancePercentage = attendancePercentage;
    attendanceRecord.status = liveClass.status === 'ENDED'
      ? classifyAttendance(attendancePercentage)
      : 'UNKNOWN';

    await liveClass.save().catch(() => {});
  }

  async handleJoinClass(socket, payload = {}) {
    const { roomId: requestedRoomId, classId, user } = payload;
    console.log(`User ${user?.firstName || 'Unknown'} ${user?.lastName || ''} attempting to join class ${requestedRoomId || classId || 'unknown'}`);

    try {
      const canonicalRoomId = await this.resolveCanonicalRoom({
        roomId: requestedRoomId,
        classId
      });

      const authenticatedUser = socket.user || user || {};
      const authenticatedUserId = this.normalizeUserId(authenticatedUser, socket.userId);

      if (!canonicalRoomId || !authenticatedUserId) {
        socket.emit('error', { message: 'Missing required data for joining class' });
        return;
      }

      const liveClass = await LiveClass.findOne({ roomId: canonicalRoomId })
        .select('_id roomId title status scheduledStartTime scheduledEndTime actualStartTime actualEndTime')
        .lean()
        .catch(() => null);

      if (!liveClass) {
        socket.emit('error', { message: 'Live class not found for this room' });
        return;
      }

      const access = resolveLiveClassAccess(liveClass);
      if (!access.canJoin) {
        socket.emit('error', {
          code: 'CLASS_NOT_JOINABLE',
          state: access.state,
          message: access.message,
          access
        });
        return;
      }

      // Always bind to canonical room ID so all participants converge to the same room.
      socket.join(canonicalRoomId);
      socket.roomId = canonicalRoomId;
      socket.classId = classId;

      this.registerSocketUser(socket, authenticatedUserId);

      const normalizedUser = {
        ...authenticatedUser,
        id: authenticatedUserId
      };

      if (!this.liveClasses.has(canonicalRoomId)) {
        this.liveClasses.set(canonicalRoomId, {
          participants: new Map(),
          socketToUserId: new Map(),
          instructor: null,
          whiteboardData: [],
          chatHistory: [],
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
      }

      const room = this.liveClasses.get(canonicalRoomId);
      const isInstructor = normalizedUser?.roleId?.name === 'INSTRUCTOR' || normalizedUser?.role?.name === 'INSTRUCTOR' || normalizedUser?.role === 'instructor';

      const existingParticipant = room.participants.get(authenticatedUserId);
      if (existingParticipant) {
        const oldSocketId = existingParticipant.socketId;
        room.socketToUserId.delete(oldSocketId);

        socket.to(canonicalRoomId).emit('peer-left', {
          peerId: oldSocketId,
          userId: authenticatedUserId
        });

        existingParticipant.socketId = socket.id;
        existingParticipant.joinedAt = new Date();
        existingParticipant.user = normalizedUser;
        room.socketToUserId.set(socket.id, authenticatedUserId);
      } else {
        const participant = {
          userId: authenticatedUserId,
          user: normalizedUser,
          socketId: socket.id,
          joinedAt: new Date(),
          isInstructor,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isHandRaised: false,
          isScreenSharing: false
        };

        room.participants.set(authenticatedUserId, participant);
        room.socketToUserId.set(socket.id, authenticatedUserId);
      }

      room.lastActivity = Date.now();

      if (isInstructor) {
        room.instructor = socket.id;
        socket.isInstructor = true;
      }

      const existingParticipants = Array.from(room.participants.values()).filter((p) => p.userId !== authenticatedUserId);

      socket.to(canonicalRoomId).emit('participant-joined', {
        userId: authenticatedUserId,
        user: normalizedUser,
        socketId: socket.id
      });

      socket.emit('class-joined', {
        roomId: canonicalRoomId,
        participants: existingParticipants,
        chatHistory: room.chatHistory || []
      });

      if (requestedRoomId && requestedRoomId !== canonicalRoomId) {
        socket.emit('room-resolved', { requestedRoomId, canonicalRoomId });
      }

      // Persist attendance marker used for missed-class notifications.
      await LiveClass.updateOne(
        { roomId: canonicalRoomId },
        {
          $addToSet: { attendees: authenticatedUserId },
          $set: { 'stats.totalParticipants': room.participants.size }
        }
      ).catch(() => {});

      await this.markAttendanceJoin(canonicalRoomId, authenticatedUserId);
    } catch (error) {
      console.error('Error joining class:', error);
      socket.emit('error', { message: 'Failed to join class: ' + error.message });
    }
  }

  handleRaiseHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) return;

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId);
    participant.isHandRaised = true;
    room.lastActivity = new Date();

    this.io.to(roomId).emit('hand-raised', {
      userId,
      user: participant.user
    });
  }

  handleLowerHand(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) return;

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId);
    participant.isHandRaised = false;
    room.lastActivity = new Date();

    this.io.to(roomId).emit('hand-lowered', {
      userId,
      user: participant.user
    });
  }

  async handleSendMessage(socket, { roomId, message }) {
    if (!roomId || !message) return;

    const room = this.liveClasses.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const userId = room.socketToUserId.get(socket.id);
    let userInfo = null;

    if (userId) {
      const participant = room.participants.get(userId);
      if (participant) {
        userInfo = participant.user;
      }
    }

    if (!userInfo && socket.user) {
      userInfo = socket.user;
    }

    if (!userInfo) {
      socket.emit('error', { message: 'User not authenticated or not in room' });
      return;
    }

    const chatMessage = {
      id: Date.now().toString(),
      message: message.trim(),
      from: userInfo,
      timestamp: new Date(),
      type: 'text'
    };

    room.lastActivity = new Date();
    room.chatHistory = room.chatHistory || [];
    room.chatHistory.push(chatMessage);
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    this.io.to(roomId).emit('chat-message', chatMessage);

    const recipientIds = Array.from(room.participants.values())
      .map((participant) => participant.userId?.toString())
      .filter((id) => id && id !== userId?.toString());

    if (recipientIds.length > 0) {
      await notificationService.createForUsers(recipientIds, {
        actorId: userId || null,
        type: 'LIVE_CHAT_MESSAGE',
        title: 'New live class message',
        message: `${userInfo.firstName || 'A participant'} sent a message in class chat`,
        priority: 'normal',
        data: {
          roomId,
          senderId: userId,
          senderName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
          preview: String(message).slice(0, 120)
        }
      });
    }
  }

  async handleLeave(socket, roomId) {
    if (!roomId) return;

    if (!this.rooms[roomId]) {
      this.rooms[roomId] = new Set();
    }

    if (this.rooms[roomId].has(socket.id)) {
      this.rooms[roomId].delete(socket.id);
    }

    const room = this.liveClasses.get(roomId);
    let userId = null;

    if (room) {
      userId = room.socketToUserId.get(socket.id);
      if (userId) {
        room.participants.delete(userId);
        room.socketToUserId.delete(socket.id);
        room.lastActivity = new Date();
      }
    }

    if (userId) {
      await this.markAttendanceLeave(roomId, userId);

      socket.to(roomId).emit('peer-left', {
        peerId: socket.id,
        userId
      });
      socket.to(roomId).emit('participant-left', {
        userId,
        socketId: socket.id
      });
    }

    socket.leave(roomId);
  }

  handleStartScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) return;

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId);
    participant.isScreenSharing = true;
    room.lastActivity = new Date();

    socket.to(roomId).emit('screen-share-started', {
      userId,
      socketId: socket.id,
      user: participant.user
    });
  }

  handleStopScreenShare(socket, { roomId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) return;

    const userId = room.socketToUserId.get(socket.id);
    if (!userId || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId);
    participant.isScreenSharing = false;
    room.lastActivity = new Date();

    socket.to(roomId).emit('screen-share-stopped', {
      userId,
      socketId: socket.id,
      user: participant.user
    });
  }

  handleInstructorAction(socket, { roomId, action, targetUserId }) {
    const room = this.liveClasses.get(roomId);
    if (!room) {
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    const instructorUserId = room.socketToUserId.get(socket.id);
    if (!instructorUserId || !room.participants.has(instructorUserId)) {
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    const instructor = room.participants.get(instructorUserId);
    if (!instructor.isInstructor) {
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    const targetParticipant = room.participants.get(targetUserId);
    if (!targetParticipant || targetParticipant.isInstructor) {
      socket.emit('instructor-action-performed', { action, targetUserId, success: false });
      return;
    }

    let success = true;

    try {
      switch (action) {
        case 'disconnect': {
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action: 'disconnect',
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });

          const forcedSocketId = targetParticipant.socketId;
          const forcedUserId = targetParticipant.userId;

          room.participants.delete(forcedUserId);
          room.socketToUserId.delete(forcedSocketId);
          room.lastActivity = new Date();

          if (this.rooms[roomId] && this.rooms[roomId].has(forcedSocketId)) {
            this.rooms[roomId].delete(forcedSocketId);
          }

          socket.to(roomId).emit('peer-left', {
            peerId: forcedSocketId,
            userId: forcedUserId
          });

          socket.to(roomId).emit('participant-left', {
            userId: forcedUserId,
            socketId: forcedSocketId
          });

          setTimeout(() => {
            const targetSocket = this.io.sockets.sockets.get(forcedSocketId);
            if (targetSocket) {
              targetSocket.disconnect(true);
            }
          }, 500);
          break;
        }

        case 'mute':
        case 'unmute':
        case 'disable-video':
        case 'enable-video':
        case 'stop-screen-share':
          this.io.to(targetParticipant.socketId).emit('instructor-action-received', {
            action,
            instructorName: `${instructor.user.firstName} ${instructor.user.lastName}`
          });

          if (action === 'stop-screen-share') {
            targetParticipant.isScreenSharing = false;
            this.io.to(roomId).emit('screen-share-stopped', {
              userId: targetUserId,
              socketId: targetParticipant.socketId,
              user: targetParticipant.user
            });
          }

          if (action === 'mute' || action === 'unmute') {
            targetParticipant.isAudioEnabled = action === 'unmute';
            this.io.to(roomId).emit('participant-audio-toggled', {
              userId: targetUserId,
              audioOn: action === 'unmute'
            });
          }
          break;

        default:
          success = false;
      }
    } catch (error) {
      console.error(`Error performing instructor action ${action}:`, error);
      success = false;
    }

    socket.emit('instructor-action-performed', {
      action,
      targetUserId,
      success
    });

    room.lastActivity = new Date();
  }
}

module.exports = SocketHandler;
