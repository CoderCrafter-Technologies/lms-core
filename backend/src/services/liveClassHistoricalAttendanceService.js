const LiveClass = require('../models/LiveClass');
const Enrollment = require('../models/Enrollment');
const { classifyAttendance, getClassDurationMinutes } = require('./liveClassAttendanceService');

const ACTIVE_OR_COMPLETED_ENROLLMENT_STATUSES = ['ENROLLED', 'COMPLETED'];

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'object' && value.id) return value.id.toString();
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

const normalizeExistingRecord = (record, classDurationMinutes) => {
  const totalDurationMinutes = Math.max(0, Number(record.totalDurationMinutes || 0));
  const attendancePercentage = Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(Number(record.attendancePercentage))
        ? Number(record.attendancePercentage)
        : Math.round((Math.min(totalDurationMinutes, classDurationMinutes) / Math.max(classDurationMinutes, 1)) * 100)
    )
  );

  return {
    userId: record.userId,
    joinedAt: record.joinedAt || null,
    leftAt: record.leftAt || null,
    totalDurationMinutes,
    attendancePercentage,
    status: record.status && record.status !== 'UNKNOWN'
      ? record.status
      : classifyAttendance(attendancePercentage)
  };
};

const buildLegacyRecord = (studentId, attendeeSet, classDurationMinutes) => {
  const isAttendee = attendeeSet.has(studentId);
  const attendancePercentage = isAttendee ? 100 : 0;

  return {
    userId: studentId,
    joinedAt: null,
    leftAt: null,
    totalDurationMinutes: isAttendee ? classDurationMinutes : 0,
    attendancePercentage,
    status: classifyAttendance(attendancePercentage)
  };
};

const rebaselineHistoricalAttendance = async ({ batchId = null, dryRun = false, limit = 500 }) => {
  const classFilter = {
    status: 'ENDED',
    $or: [
      { attendanceRecords: { $exists: false } },
      { attendanceRecords: { $size: 0 } },
      { 'attendanceRecords.status': 'UNKNOWN' }
    ]
  };
  if (batchId) classFilter.batchId = batchId;

  const classes = await LiveClass.find(classFilter)
    .select('batchId attendees attendanceRecords scheduledStartTime scheduledEndTime actualStartTime actualEndTime status')
    .sort({ scheduledStartTime: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 500, 2000)));

  let scannedClasses = 0;
  let updatedClasses = 0;
  let generatedRecords = 0;
  let normalizedRecords = 0;

  for (const liveClass of classes) {
    scannedClasses += 1;
    const classDurationMinutes = getClassDurationMinutes(liveClass);

    const enrollments = await Enrollment.find({
      batchId: liveClass.batchId,
      status: { $in: ACTIVE_OR_COMPLETED_ENROLLMENT_STATUSES }
    }).select('studentId');

    const rosterIds = enrollments
      .map((item) => normalizeId(item.studentId))
      .filter(Boolean);

    const attendeeSet = new Set((liveClass.attendees || []).map((id) => normalizeId(id)).filter(Boolean));
    const existingRecords = Array.isArray(liveClass.attendanceRecords) ? liveClass.attendanceRecords : [];
    const existingByUserId = new Map(
      existingRecords
        .map((record) => [normalizeId(record.userId), record])
        .filter(([id]) => Boolean(id))
    );

    const nextRecords = [];

    for (const studentId of rosterIds) {
      const existing = existingByUserId.get(studentId);
      if (existing) {
        const normalized = normalizeExistingRecord(existing, classDurationMinutes);
        if (
          normalized.attendancePercentage !== Number(existing.attendancePercentage || 0) ||
          normalized.status !== existing.status
        ) {
          normalizedRecords += 1;
        }
        nextRecords.push(normalized);
      } else {
        const generated = buildLegacyRecord(studentId, attendeeSet, classDurationMinutes);
        generatedRecords += 1;
        nextRecords.push(generated);
      }
    }

    // Keep existing records for users no longer in roster to avoid data loss.
    for (const record of existingRecords) {
      const id = normalizeId(record.userId);
      if (!id || rosterIds.includes(id)) continue;
      nextRecords.push(normalizeExistingRecord(record, classDurationMinutes));
    }

    const hasChanged = JSON.stringify(nextRecords) !== JSON.stringify(existingRecords.map((r) => normalizeExistingRecord(r, classDurationMinutes)));
    if (!hasChanged) continue;

    updatedClasses += 1;
    if (!dryRun) {
      liveClass.attendanceRecords = nextRecords;
      await liveClass.save();
    }
  }

  return {
    dryRun,
    scannedClasses,
    updatedClasses,
    generatedRecords,
    normalizedRecords
  };
};

module.exports = {
  rebaselineHistoricalAttendance
};
