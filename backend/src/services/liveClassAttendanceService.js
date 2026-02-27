const PRESENT_THRESHOLD = 80;
const LEFT_EARLY_THRESHOLD = 50;

const resolveEndTime = (liveClass) =>
  liveClass.actualEndTime ? new Date(liveClass.actualEndTime) : new Date(liveClass.scheduledEndTime);

const resolveStartTime = (liveClass) =>
  liveClass.actualStartTime ? new Date(liveClass.actualStartTime) : new Date(liveClass.scheduledStartTime);

const getClassDurationMinutes = (liveClass) => {
  const start = resolveStartTime(liveClass);
  const end = resolveEndTime(liveClass);
  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  return Math.max(duration, 1);
};

const classifyAttendance = (attendancePercentage = 0) => {
  if (attendancePercentage >= PRESENT_THRESHOLD) return 'PRESENT';
  if (attendancePercentage >= LEFT_EARLY_THRESHOLD) return 'LEFT_EARLY';
  return 'ABSENT';
};

const normalizeAttendanceRecord = (liveClass, record) => {
  if (!record) {
    return {
      attendedMinutes: 0,
      attendancePercentage: 0,
      attendanceStatus: liveClass.status === 'ENDED' ? 'ABSENT' : 'UNKNOWN'
    };
  }

  const classDurationMinutes = getClassDurationMinutes(liveClass);

  const joinedAt = record.joinedAt ? new Date(record.joinedAt) : null;
  const leftAt = record.leftAt ? new Date(record.leftAt) : null;
  const activeLeftAt = leftAt || (liveClass.status === 'ENDED' ? resolveEndTime(liveClass) : new Date());

  let totalDurationMinutes = Math.max(record.totalDurationMinutes || 0, 0);
  if (joinedAt && activeLeftAt && activeLeftAt > joinedAt) {
    totalDurationMinutes += Math.round((activeLeftAt.getTime() - joinedAt.getTime()) / (1000 * 60));
  }

  const cappedDuration = Math.min(totalDurationMinutes, classDurationMinutes);
  const attendancePercentage = Math.min(
    100,
    Math.max(0, Math.round((cappedDuration / classDurationMinutes) * 100))
  );

  return {
    attendedMinutes: cappedDuration,
    attendancePercentage,
    attendanceStatus: liveClass.status === 'ENDED' ? classifyAttendance(attendancePercentage) : 'UNKNOWN'
  };
};

const getStudentAttendanceForClass = (liveClass, studentId) => {
  if (!studentId) {
    return {
      attendedMinutes: 0,
      attendancePercentage: 0,
      attendanceStatus: 'UNKNOWN'
    };
  }

  const attendanceRecords = Array.isArray(liveClass.attendanceRecords) ? liveClass.attendanceRecords : [];
  const targetRecord = attendanceRecords.find(
    (record) => record.userId?.toString() === studentId.toString()
  );

  return normalizeAttendanceRecord(liveClass, targetRecord);
};

const enrichLiveClassForStudent = (liveClass, studentId) => {
  const normalized = getStudentAttendanceForClass(liveClass, studentId);
  return {
    ...liveClass,
    ...normalized
  };
};

const enrichLiveClassesForStudent = (liveClasses = [], studentId) =>
  liveClasses.map((classItem) => enrichLiveClassForStudent(classItem, studentId));

module.exports = {
  PRESENT_THRESHOLD,
  LEFT_EARLY_THRESHOLD,
  classifyAttendance,
  getClassDurationMinutes,
  getStudentAttendanceForClass,
  enrichLiveClassForStudent,
  enrichLiveClassesForStudent
};
