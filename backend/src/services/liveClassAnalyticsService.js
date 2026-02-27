const LiveClass = require('../models/LiveClass');
const Enrollment = require('../models/Enrollment');
const {
  getClassDurationMinutes,
  getStudentAttendanceForClass
} = require('./liveClassAttendanceService');

const ACTIVE_ENROLLMENT_STATUSES = ['ENROLLED', 'COMPLETED'];

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return value._id.toString();
    if (value.id) return value.id.toString();
    if (typeof value.toString === 'function') return value.toString();
  }
  return String(value);
};

const getRoleName = (userRole) => {
  if (!userRole) return '';
  if (typeof userRole === 'string') return userRole.toLowerCase();
  if (typeof userRole === 'object' && userRole.name) return String(userRole.name).toLowerCase();
  return String(userRole).toLowerCase();
};

const getClassStartTime = (liveClass) =>
  liveClass.actualStartTime ? new Date(liveClass.actualStartTime) : new Date(liveClass.scheduledStartTime);

const getClassEndTime = (liveClass) =>
  liveClass.actualEndTime ? new Date(liveClass.actualEndTime) : new Date(liveClass.scheduledEndTime);

const resolveClassStatusLabel = (liveClass) => {
  const now = new Date();
  const startTime = new Date(liveClass.scheduledStartTime);
  const endTime = new Date(liveClass.scheduledEndTime);

  if (liveClass.status === 'ENDED') return 'ENDED';
  if (liveClass.status === 'LIVE') return 'LIVE';
  if (liveClass.status === 'CANCELLED') return 'CANCELLED';
  if (liveClass.status === 'SCHEDULED' && now < startTime) return 'NOT_STARTED';
  if (liveClass.status === 'SCHEDULED' && now >= startTime && now <= endTime) return 'IN_PROGRESS';
  return liveClass.status || 'UNKNOWN';
};

const isInstructorAllowedForClass = (liveClass, userId) => {
  const instructorId = toObjectIdString(liveClass.instructorId);
  return instructorId && instructorId === toObjectIdString(userId);
};

const getLateJoinThresholdMinutes = (classDurationMinutes) => Math.max(5, Math.round(classDurationMinutes * 0.1));

const getAttendanceFilterMatch = (row, statusFilter) => {
  if (!statusFilter || statusFilter === 'ALL') return true;

  if (statusFilter === 'PRESENT') return row.attendanceStatus === 'PRESENT';
  if (statusFilter === 'LEFT_EARLY') return row.attendanceStatus === 'LEFT_EARLY';
  if (statusFilter === 'ABSENT') return row.attendanceStatus === 'ABSENT';
  if (statusFilter === 'LATE_JOINER') return row.isLateJoiner;
  if (statusFilter === 'LATE_JOINER_LEFT_EARLY') return row.isLateJoiner && row.isLeftEarly;

  return true;
};

const withPercentFilters = (row, minPercent, maxPercent) => {
  if (typeof minPercent === 'number' && row.attendancePercentage < minPercent) return false;
  if (typeof maxPercent === 'number' && row.attendancePercentage > maxPercent) return false;
  return true;
};

const applySearchFilter = (row, search) => {
  if (!search) return true;
  const normalized = search.toLowerCase();
  return (
    row.studentName.toLowerCase().includes(normalized) ||
    row.studentEmail.toLowerCase().includes(normalized)
  );
};

const summarizeRows = (rows) => {
  const summary = {
    totalStudents: rows.length,
    present: 0,
    leftEarly: 0,
    absent: 0,
    lateJoiners: 0,
    lateJoinersLeftEarly: 0,
    averageAttendancePercentage: 0
  };

  let totalPercentage = 0;

  rows.forEach((row) => {
    if (row.attendanceStatus === 'PRESENT') summary.present += 1;
    if (row.attendanceStatus === 'LEFT_EARLY') summary.leftEarly += 1;
    if (row.attendanceStatus === 'ABSENT') summary.absent += 1;
    if (row.isLateJoiner) summary.lateJoiners += 1;
    if (row.isLateJoiner && row.isLeftEarly) summary.lateJoinersLeftEarly += 1;
    totalPercentage += row.attendancePercentage || 0;
  });

  summary.averageAttendancePercentage = rows.length > 0
    ? Math.round(totalPercentage / rows.length)
    : 0;

  return summary;
};

const formatPeriodKey = (date, view) => {
  const currentDate = new Date(date);

  if (view === 'month') {
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  const utcDate = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate()
  ));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const buildClassRosterRows = (liveClass, enrollments) => {
  const classDurationMinutes = getClassDurationMinutes(liveClass);
  const classStartTime = getClassStartTime(liveClass);
  const lateJoinThresholdMinutes = getLateJoinThresholdMinutes(classDurationMinutes);

  return enrollments.map((enrollment) => {
    const studentId = toObjectIdString(enrollment.studentId?._id || enrollment.studentId);
    const attendance = getStudentAttendanceForClass(liveClass, studentId);

    const attendanceRecord = (liveClass.attendanceRecords || []).find(
      (record) => toObjectIdString(record.userId) === studentId
    );

    const joinedAt = attendanceRecord?.joinedAt ? new Date(attendanceRecord.joinedAt) : null;
    const minutesLate = joinedAt
      ? Math.max(0, Math.round((joinedAt.getTime() - classStartTime.getTime()) / (1000 * 60)))
      : null;

    const isLateJoiner = minutesLate !== null && minutesLate >= lateJoinThresholdMinutes;
    const isLeftEarly = attendance.attendanceStatus === 'LEFT_EARLY';

    return {
      enrollmentId: enrollment._id?.toString() || enrollment.id,
      studentId,
      studentName: `${enrollment.studentId?.firstName || ''} ${enrollment.studentId?.lastName || ''}`.trim() || 'Unknown Student',
      studentEmail: enrollment.studentId?.email || '',
      studentStatus: enrollment.status,
      attendanceStatus: attendance.attendanceStatus,
      attendancePercentage: attendance.attendancePercentage,
      attendedMinutes: attendance.attendedMinutes,
      classDurationMinutes,
      isLateJoiner,
      isLeftEarly,
      lateByMinutes: minutesLate,
      attendanceTags: [
        ...(isLateJoiner ? ['LATE_JOINER'] : []),
        ...(isLeftEarly ? ['LEFT_EARLY'] : []),
        ...(attendance.attendanceStatus === 'ABSENT' ? ['ABSENT'] : [])
      ]
    };
  });
};

const getEnrollmentsByBatch = async (batchId) => {
  return Enrollment.find({
    batchId,
    status: { $in: ACTIVE_ENROLLMENT_STATUSES }
  })
    .select('studentId status')
    .populate({ path: 'studentId', select: 'firstName lastName email' })
    .lean();
};

const getClassByIdForAttendance = async (classId) => {
  return LiveClass.findById(classId)
    .populate({
      path: 'batchId',
      select: 'name batchCode courseId schedule instructorId',
      populate: { path: 'courseId', select: 'title' }
    })
    .populate({ path: 'instructorId', select: 'firstName lastName email' })
    .lean();
};

const getClassAttendanceRoster = async ({
  classId,
  userRole,
  userId,
  status,
  minPercent,
  maxPercent,
  search,
  page = 1,
  limit = 50
}) => {
  const liveClass = await getClassByIdForAttendance(classId);

  if (!liveClass) {
    const error = new Error('Live class not found');
    error.statusCode = 404;
    throw error;
  }

  const roleName = getRoleName(userRole);
  if (roleName === 'instructor' && !isInstructorAllowedForClass(liveClass, userId)) {
    const error = new Error('You can only access attendance for your own classes');
    error.statusCode = 403;
    throw error;
  }

  const enrollments = await getEnrollmentsByBatch(liveClass.batchId?._id || liveClass.batchId);
  const rows = buildClassRosterRows(liveClass, enrollments);

  const normalizedStatus = (status || 'ALL').toUpperCase();
  const filteredRows = rows.filter((row) =>
    getAttendanceFilterMatch(row, normalizedStatus) &&
    withPercentFilters(row, minPercent, maxPercent) &&
    applySearchFilter(row, search)
  );

  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const start = (normalizedPage - 1) * normalizedLimit;

  const paginatedRows = filteredRows.slice(start, start + normalizedLimit);
  const summary = summarizeRows(rows);

  return {
    classSummary: {
      classId: liveClass._id?.toString(),
      title: liveClass.title,
      status: liveClass.status,
      statusLabel: resolveClassStatusLabel(liveClass),
      scheduledStartTime: liveClass.scheduledStartTime,
      scheduledEndTime: liveClass.scheduledEndTime,
      batch: {
        id: toObjectIdString(liveClass.batchId?._id || liveClass.batchId),
        name: liveClass.batchId?.name,
        batchCode: liveClass.batchId?.batchCode,
        courseTitle: liveClass.batchId?.courseId?.title || ''
      },
      summary
    },
    students: paginatedRows,
    filters: {
      status: normalizedStatus,
      minPercent,
      maxPercent,
      search: search || ''
    },
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total: filteredRows.length,
      totalPages: Math.max(1, Math.ceil(filteredRows.length / normalizedLimit))
    }
  };
};

const buildClassStats = async (liveClasses, roleName) => {
  const enrollmentCache = new Map();

  const rows = [];

  for (const liveClass of liveClasses) {
    const batchId = toObjectIdString(liveClass.batchId?._id || liveClass.batchId);

    if (!enrollmentCache.has(batchId)) {
      const enrollments = await getEnrollmentsByBatch(batchId);
      enrollmentCache.set(batchId, enrollments);
    }

    const enrollments = enrollmentCache.get(batchId) || [];
    const attendanceRows = buildClassRosterRows(liveClass, enrollments);
    const summary = summarizeRows(attendanceRows);

    rows.push({
      classId: toObjectIdString(liveClass._id),
      title: liveClass.title,
      status: liveClass.status,
      statusLabel: resolveClassStatusLabel(liveClass),
      scheduledStartTime: liveClass.scheduledStartTime,
      scheduledEndTime: liveClass.scheduledEndTime,
      batch: {
        id: batchId,
        name: liveClass.batchId?.name,
        batchCode: liveClass.batchId?.batchCode,
        courseTitle: liveClass.batchId?.courseId?.title || ''
      },
      instructor: {
        id: toObjectIdString(liveClass.instructorId?._id || liveClass.instructorId),
        name: `${liveClass.instructorId?.firstName || ''} ${liveClass.instructorId?.lastName || ''}`.trim()
      },
      summary
    });
  }

  if (roleName === 'instructor') {
    return rows;
  }

  return rows;
};

const getAccessibleLiveClassFilter = ({ userRole, userId, batchId, from, to, includeUpcoming = false }) => {
  const filter = {
    status: includeUpcoming ? { $in: ['SCHEDULED', 'LIVE', 'ENDED'] } : 'ENDED'
  };

  if (batchId) {
    filter.batchId = batchId;
  }

  if (from || to) {
    filter.scheduledStartTime = {};
    if (from) filter.scheduledStartTime.$gte = new Date(from);
    if (to) filter.scheduledStartTime.$lte = new Date(to);
  }

  const roleName = getRoleName(userRole);
  if (roleName === 'instructor') {
    filter.instructorId = userId;
  }

  return filter;
};

const getRecentClassStats = async ({ userRole, userId, limit = 7, batchId }) => {
  const filter = getAccessibleLiveClassFilter({ userRole, userId, batchId });

  const classes = await LiveClass.find(filter)
    .select('title status scheduledStartTime scheduledEndTime attendanceRecords batchId instructorId')
    .populate({
      path: 'batchId',
      select: 'name batchCode courseId',
      populate: { path: 'courseId', select: 'title' }
    })
    .populate({ path: 'instructorId', select: 'firstName lastName' })
    .sort({ scheduledStartTime: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 7)))
    .lean();

  const roleName = getRoleName(userRole);
  return buildClassStats(classes, roleName);
};

const getAttendanceAnalytics = async ({
  userRole,
  userId,
  view = 'class',
  batchId,
  from,
  to,
  limit = 100
}) => {
  const roleName = getRoleName(userRole);
  const normalizedView = ['class', 'week', 'month'].includes(String(view).toLowerCase())
    ? String(view).toLowerCase()
    : 'class';

  const filter = getAccessibleLiveClassFilter({
    userRole,
    userId,
    batchId,
    from,
    to,
    includeUpcoming: normalizedView === 'class'
  });
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));

  const classes = await LiveClass.find(filter)
    .select('title status scheduledStartTime scheduledEndTime attendanceRecords batchId instructorId')
    .populate({
      path: 'batchId',
      select: 'name batchCode courseId',
      populate: { path: 'courseId', select: 'title' }
    })
    .populate({ path: 'instructorId', select: 'firstName lastName' })
    .sort({ scheduledStartTime: -1 })
    .limit(safeLimit)
    .lean();

  const classStats = await buildClassStats(classes, roleName);

  if (normalizedView === 'class') {
    return {
      view: normalizedView,
      rows: classStats
    };
  }

  const grouped = new Map();

  classStats.forEach((classItem) => {
    const key = formatPeriodKey(classItem.scheduledStartTime, normalizedView);
    const current = grouped.get(key) || {
      key,
      totalClasses: 0,
      totalStudents: 0,
      present: 0,
      leftEarly: 0,
      absent: 0,
      lateJoiners: 0,
      lateJoinersLeftEarly: 0,
      totalAttendancePercentage: 0,
      classes: []
    };

    current.totalClasses += 1;
    current.totalStudents += classItem.summary.totalStudents;
    current.present += classItem.summary.present;
    current.leftEarly += classItem.summary.leftEarly;
    current.absent += classItem.summary.absent;
    current.lateJoiners += classItem.summary.lateJoiners;
    current.lateJoinersLeftEarly += classItem.summary.lateJoinersLeftEarly;
    current.totalAttendancePercentage += classItem.summary.averageAttendancePercentage;
    current.classes.push({
      classId: classItem.classId,
      title: classItem.title,
      scheduledStartTime: classItem.scheduledStartTime,
      batchName: classItem.batch?.name || ''
    });

    grouped.set(key, current);
  });

  const rows = Array.from(grouped.values())
    .map((item) => ({
      ...item,
      averageAttendancePercentage: item.totalClasses > 0
        ? Math.round(item.totalAttendancePercentage / item.totalClasses)
        : 0
    }))
    .sort((a, b) => String(b.key).localeCompare(String(a.key)));

  return {
    view: normalizedView,
    rows
  };
};

module.exports = {
  getClassAttendanceRoster,
  getRecentClassStats,
  getAttendanceAnalytics
};
