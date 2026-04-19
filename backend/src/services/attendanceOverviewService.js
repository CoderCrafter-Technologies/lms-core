const Enrollment = require('../models/Enrollment');
const LiveClass = require('../models/LiveClass');
const {
  classifyAttendance,
  getStudentAttendanceForClass,
} = require('./liveClassAttendanceService');
const { syncEnrollmentsProgress } = require('./enrollmentProgressService');

const ACTIVE_ENROLLMENT_STATUSES = ['ENROLLED', 'COMPLETED'];

const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    if (typeof value.toString === 'function') return String(value.toString());
  }
  return String(value);
};

const toPercent = (numerator, denominator) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const formatPeriodLabel = (date) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
  });

const normalizeAttendanceStatus = (attendance) =>
  attendance.attendanceStatus === 'UNKNOWN'
    ? classifyAttendance(attendance.attendancePercentage || 0)
    : attendance.attendanceStatus;

const createSummary = () => ({
  attendancePercentage: 0,
  attendedClasses: 0,
  totalClasses: 0,
  presentClasses: 0,
  leftEarlyClasses: 0,
  absentClasses: 0,
  coursesCount: 0,
});

const createTrendBucket = (key, label) => ({
  key,
  label,
  attendancePercentage: 0,
  attendedClasses: 0,
  totalClasses: 0,
  presentClasses: 0,
  leftEarlyClasses: 0,
  absentClasses: 0,
});

const finalizeTrend = (bucketMap) =>
  Array.from(bucketMap.values())
    .map((bucket) => ({
      ...bucket,
      attendancePercentage: toPercent(bucket.attendedClasses, bucket.totalClasses),
    }))
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .slice(-6);

const groupKeyFromDate = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getStudentAttendanceOverview = async ({ studentId }) => {
  const enrollments = await Enrollment.find({
    studentId,
    status: { $in: ACTIVE_ENROLLMENT_STATUSES },
  })
    .populate({ path: 'courseId', select: 'title thumbnail shortDescription description' })
    .populate({ path: 'batchId', select: 'name batchCode' });

  await syncEnrollmentsProgress(enrollments);

  const batchIds = enrollments
    .map((enrollment) => toObjectIdString(enrollment.batchId))
    .filter(Boolean);

  const endedClasses = batchIds.length > 0
    ? await LiveClass.find({
        batchId: { $in: batchIds },
        status: 'ENDED',
      })
        .select('title batchId scheduledStartTime scheduledEndTime actualStartTime actualEndTime attendanceRecords status')
        .populate({
          path: 'batchId',
          select: 'name batchCode courseId',
          populate: { path: 'courseId', select: 'title thumbnail' },
        })
        .sort({ scheduledStartTime: 1 })
        .lean()
    : [];

  const summary = createSummary();
  const trendMap = new Map();

  endedClasses.forEach((liveClass) => {
    const attendance = getStudentAttendanceForClass(liveClass, studentId);
    const status = normalizeAttendanceStatus(attendance);

    summary.totalClasses += 1;
    if (status === 'PRESENT') {
      summary.attendedClasses += 1;
      summary.presentClasses += 1;
    } else if (status === 'LEFT_EARLY') {
      summary.leftEarlyClasses += 1;
    } else {
      summary.absentClasses += 1;
    }

    const key = groupKeyFromDate(liveClass.scheduledStartTime);
    const existing = trendMap.get(key) || createTrendBucket(key, formatPeriodLabel(liveClass.scheduledStartTime));
    existing.totalClasses += 1;
    if (status === 'PRESENT') {
      existing.attendedClasses += 1;
      existing.presentClasses += 1;
    } else if (status === 'LEFT_EARLY') {
      existing.leftEarlyClasses += 1;
    } else {
      existing.absentClasses += 1;
    }
    trendMap.set(key, existing);
  });

  summary.attendancePercentage = toPercent(summary.attendedClasses, summary.totalClasses);
  summary.coursesCount = enrollments.length;

  const courses = enrollments
    .map((enrollment) => ({
      courseId: toObjectIdString(enrollment.courseId),
      courseTitle: enrollment.courseId?.title || 'Course',
      thumbnail: enrollment.courseId?.thumbnail || '',
      batchId: toObjectIdString(enrollment.batchId),
      batchName: enrollment.batchId?.name || '',
      attendancePercentage: Number(enrollment.attendance?.attendancePercentage || 0),
      attendedClasses: Number(enrollment.attendance?.attendedClasses || 0),
      totalClasses: Number(enrollment.attendance?.totalClasses || 0),
    }))
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

  return {
    audience: 'student',
    period: 'month',
    summary,
    trend: finalizeTrend(trendMap),
    courses,
  };
};

const getInstructorAttendanceOverview = async ({ instructorId }) => {
  const endedClasses = await LiveClass.find({
    instructorId,
    status: 'ENDED',
  })
    .select('title batchId instructorId scheduledStartTime scheduledEndTime actualStartTime actualEndTime attendanceRecords status')
    .populate({
      path: 'batchId',
      select: 'name batchCode courseId',
      populate: { path: 'courseId', select: 'title thumbnail' },
    })
    .sort({ scheduledStartTime: 1 })
    .lean();

  const enrollmentsByBatch = new Map();
  const summary = createSummary();
  const trendMap = new Map();
  const courseMap = new Map();

  for (const liveClass of endedClasses) {
    const batchId = toObjectIdString(liveClass.batchId);

    if (!enrollmentsByBatch.has(batchId)) {
      const enrollments = await Enrollment.find({
        batchId,
        status: { $in: ACTIVE_ENROLLMENT_STATUSES },
      })
        .select('studentId')
        .lean();
      enrollmentsByBatch.set(batchId, enrollments);
    }

    const enrollments = enrollmentsByBatch.get(batchId) || [];
    let present = 0;
    let leftEarly = 0;
    let absent = 0;

    enrollments.forEach((enrollment) => {
      const attendance = getStudentAttendanceForClass(liveClass, enrollment.studentId);
      const status = normalizeAttendanceStatus(attendance);

      if (status === 'PRESENT') present += 1;
      else if (status === 'LEFT_EARLY') leftEarly += 1;
      else absent += 1;
    });

    const totalStudents = enrollments.length;
    const averageAttendancePercentage = toPercent(present, totalStudents);

    summary.totalClasses += 1;
    summary.attendedClasses += present;
    summary.presentClasses += present;
    summary.leftEarlyClasses += leftEarly;
    summary.absentClasses += absent;

    const trendKey = groupKeyFromDate(liveClass.scheduledStartTime);
    const trendBucket =
      trendMap.get(trendKey) || createTrendBucket(trendKey, formatPeriodLabel(liveClass.scheduledStartTime));
    trendBucket.totalClasses += totalStudents;
    trendBucket.attendedClasses += present;
    trendBucket.presentClasses += present;
    trendBucket.leftEarlyClasses += leftEarly;
    trendBucket.absentClasses += absent;
    trendMap.set(trendKey, trendBucket);

    const courseId = toObjectIdString(liveClass.batchId?.courseId);
    if (!courseId) continue;

    const existingCourse = courseMap.get(courseId) || {
      courseId,
      courseTitle: liveClass.batchId?.courseId?.title || 'Course',
      thumbnail: liveClass.batchId?.courseId?.thumbnail || '',
      batchId,
      batchName: liveClass.batchId?.name || '',
      attendancePercentage: 0,
      attendedClasses: 0,
      totalClasses: 0,
      totalStudents: 0,
      presentClasses: 0,
      leftEarlyClasses: 0,
      absentClasses: 0,
      classCount: 0,
    };

    existingCourse.totalClasses += totalStudents;
    existingCourse.attendedClasses += present;
    existingCourse.totalStudents += totalStudents;
    existingCourse.presentClasses += present;
    existingCourse.leftEarlyClasses += leftEarly;
    existingCourse.absentClasses += absent;
    existingCourse.classCount += 1;
    existingCourse.attendancePercentage = toPercent(
      existingCourse.attendedClasses,
      existingCourse.totalClasses,
    );

    courseMap.set(courseId, existingCourse);
  }

  summary.attendancePercentage = toPercent(summary.attendedClasses, summary.attendedClasses + summary.leftEarlyClasses + summary.absentClasses);
  summary.coursesCount = courseMap.size;

  const courses = Array.from(courseMap.values())
    .map((course) => ({
      courseId: course.courseId,
      courseTitle: course.courseTitle,
      thumbnail: course.thumbnail,
      batchId: course.batchId,
      batchName: course.batchName,
      attendancePercentage: course.attendancePercentage,
      attendedClasses: course.attendedClasses,
      totalClasses: course.totalClasses,
      classCount: course.classCount,
      totalStudents: course.totalStudents,
    }))
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

  return {
    audience: 'instructor',
    period: 'month',
    summary,
    trend: finalizeTrend(trendMap),
    courses,
  };
};

module.exports = {
  getStudentAttendanceOverview,
  getInstructorAttendanceOverview,
};
