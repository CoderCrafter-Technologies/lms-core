const { randomUUID } = require('crypto');

const ROOM_PREFIX = 'cls';

const sanitizeSegment = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '');

const generateLiveClassRoomId = () => `${ROOM_PREFIX}_${randomUUID()}`;

const deterministicRoomIdForClass = (classId) => {
  const normalized = sanitizeSegment(classId);
  if (!normalized) return null;
  return `${ROOM_PREFIX}_${normalized}`;
};

module.exports = {
  generateLiveClassRoomId,
  deterministicRoomIdForClass
};
