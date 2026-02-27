const mongoose = require('mongoose');
const LiveClass = require('../models/LiveClass');
const { classifyAttendance, getStudentAttendanceForClass } = require('./liveClassAttendanceService');

const ACTIVE_CLASS_STATUSES = ['SCHEDULED', 'LIVE', 'ENDED'];

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;

  const parseCandidate = (candidate) => {
    if (!candidate) return null;
    if (candidate instanceof mongoose.Types.ObjectId) return candidate;
    const normalized = String(candidate);
    if (!mongoose.Types.ObjectId.isValid(normalized)) return null;
    return new mongoose.Types.ObjectId(normalized);
  };

  if (typeof value === 'string') {
    return parseCandidate(value);
  }

  if (typeof value === 'object') {
    return (
      parseCandidate(value._id) ||
      parseCandidate(value.id) ||
      parseCandidate(value.batchId) ||
      parseCandidate(value.studentId) ||
      null
    );
  }

  return null;
};

const hasProgressChanged = (enrollment, nextProgress, nextAttendance) => {
  return (
    (enrollment.progress?.completedClasses || 0) !== nextProgress.completedClasses ||
    (enrollment.progress?.totalClasses || 0) !== nextProgress.totalClasses ||
    (enrollment.progress?.completionPercentage || 0) !== nextProgress.completionPercentage ||
    (enrollment.attendance?.attendedClasses || 0) !== nextAttendance.attendedClasses ||
    (enrollment.attendance?.totalClasses || 0) !== nextAttendance.totalClasses ||
    (enrollment.attendance?.attendancePercentage || 0) !== nextAttendance.attendancePercentage
  );
};

const computeEnrollmentProgress = async (enrollment) => {
  const batchId = toObjectId(enrollment.batchId);
  const studentId = toObjectId(enrollment.studentId);

  if (!batchId || !studentId) {
    return {
      progress: {
        completedClasses: 0,
        totalClasses: 0,
        completionPercentage: 0
      },
      attendance: {
        attendedClasses: 0,
        totalClasses: 0,
        attendancePercentage: 0
      }
    };
  }

  const [totalClasses, endedClassDocs] = await Promise.all([
    LiveClass.countDocuments({
      batchId,
      status: { $in: ACTIVE_CLASS_STATUSES }
    }),
    LiveClass.find({
      batchId,
      status: 'ENDED'
    }).select('attendanceRecords scheduledStartTime scheduledEndTime actualStartTime actualEndTime status')
  ]);

  const safeTotalClasses = Math.max(totalClasses, 0);
  const safeEndedClasses = Math.max(endedClassDocs.length, 0);

  const completedClasses = Math.min(safeEndedClasses, safeTotalClasses);
  const completionPercentage = safeTotalClasses > 0
    ? Math.round((completedClasses / safeTotalClasses) * 100)
    : 0;

  const attendanceTotalClasses = safeEndedClasses;
  const attendanceAttendedClasses = endedClassDocs.reduce((count, endedClass) => {
    const attendance = getStudentAttendanceForClass(endedClass, studentId);
    const status = attendance.attendanceStatus === 'UNKNOWN'
      ? classifyAttendance(attendance.attendancePercentage)
      : attendance.attendanceStatus;
    return status === 'PRESENT' ? count + 1 : count;
  }, 0);
  const attendancePercentage = attendanceTotalClasses > 0
    ? Math.round((attendanceAttendedClasses / attendanceTotalClasses) * 100)
    : 0;

  return {
    progress: {
      completedClasses,
      totalClasses: safeTotalClasses,
      completionPercentage
    },
    attendance: {
      attendedClasses: attendanceAttendedClasses,
      totalClasses: attendanceTotalClasses,
      attendancePercentage
    }
  };
};

const syncEnrollmentProgress = async (enrollment, { persist = true } = {}) => {
  if (!enrollment) return enrollment;

  const computed = await computeEnrollmentProgress(enrollment);

  if (persist && hasProgressChanged(enrollment, computed.progress, computed.attendance)) {
    enrollment.progress = computed.progress;
    enrollment.attendance = computed.attendance;
    await enrollment.save();
  } else {
    enrollment.progress = computed.progress;
    enrollment.attendance = computed.attendance;
  }

  return enrollment;
};

const syncEnrollmentsProgress = async (enrollments, { persist = true } = {}) => {
  if (!Array.isArray(enrollments) || enrollments.length === 0) return enrollments;

  await Promise.all(enrollments.map((enrollment) => syncEnrollmentProgress(enrollment, { persist })));
  return enrollments;
};

module.exports = {
  computeEnrollmentProgress,
  syncEnrollmentProgress,
  syncEnrollmentsProgress
};
