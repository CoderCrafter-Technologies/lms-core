const { batchRepository, enrollmentRepository } = require('../repositories');

const resolveRefId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id || value.id || null;
};

const getAssessmentCourseId = (assessment) => {
  if (!assessment) return null;
  return resolveRefId(assessment.courseId);
};

const getAssessmentBatchId = (assessment) => {
  if (!assessment) return null;
  return resolveRefId(assessment.batchId);
};

const isAssessmentScheduledNow = (assessment, now = new Date()) => {
  const schedule = assessment?.schedule || {};
  if (!schedule.isScheduled) return true;

  const startDate = schedule.startDate ? new Date(schedule.startDate) : null;
  const endDate = schedule.endDate ? new Date(schedule.endDate) : null;

  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
};

const getPublishedAvailabilityClauses = (now = new Date()) => [
  { 'schedule.isScheduled': false },
  { 'schedule.isScheduled': { $exists: false } },
  {
    $and: [
      { 'schedule.isScheduled': true },
      {
        $or: [
          { 'schedule.startDate': { $exists: false } },
          { 'schedule.startDate': null },
          { 'schedule.startDate': { $lte: now } },
        ],
      },
      {
        $or: [
          { 'schedule.endDate': { $exists: false } },
          { 'schedule.endDate': null },
          { 'schedule.endDate': { $gte: now } },
        ],
      },
    ],
  },
];

const getInstructorAssignmentScope = async (instructorId) => {
  if (!instructorId) {
    return {
      batchIds: [],
      courseIds: [],
    };
  }

  const assignedBatches = await batchRepository.find(
    {
      instructorId,
      status: { $ne: 'CANCELLED' },
    },
    {
      select: '_id courseId',
    }
  );

  const batchIds = assignedBatches
    .map((batch) => String(batch.id || batch._id || ''))
    .filter(Boolean);
  const courseIds = [...new Set(
    assignedBatches
      .map((batch) => String(resolveRefId(batch.courseId) || ''))
      .filter(Boolean)
  )];

  return { batchIds, courseIds };
};

const buildInstructorAssessmentFilter = async (instructorId) => {
  const { batchIds, courseIds } = await getInstructorAssignmentScope(instructorId);
  const clauses = [{ createdBy: instructorId }];

  if (batchIds.length > 0) {
    clauses.push({ batchId: { $in: batchIds } });
  }

  if (courseIds.length > 0) {
    clauses.push({
      courseId: { $in: courseIds },
      $or: [{ batchId: null }, { batchId: { $exists: false } }],
    });
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const canInstructorAccessAssessment = async (assessment, instructorId) => {
  if (!assessment || !instructorId) return false;
  const createdById = resolveRefId(assessment.createdBy);
  if (String(createdById || '') === String(instructorId)) return true;

  const batchId = getAssessmentBatchId(assessment);
  if (batchId) {
    const batch = await batchRepository.findById(batchId, { select: 'instructorId' });
    return String(batch?.instructorId || '') === String(instructorId);
  }

  const courseId = getAssessmentCourseId(assessment);
  if (!courseId) return false;

  const assignedBatch = await batchRepository.findOne({
    courseId,
    instructorId,
    status: { $ne: 'CANCELLED' },
  });

  return Boolean(assignedBatch);
};

const canStudentAccessAssessment = async (
  assessment,
  studentId,
  {
    requirePublished = true,
    requireAvailability = false,
  } = {}
) => {
  if (!assessment || !studentId) return false;
  if (requirePublished && assessment.status !== 'published') return false;
  if (requireAvailability && !isAssessmentScheduledNow(assessment)) return false;

  const courseId = getAssessmentCourseId(assessment);
  if (!courseId) return false;

  const enrollmentFilter = {
    studentId,
    courseId,
    status: 'ENROLLED',
  };

  const batchId = getAssessmentBatchId(assessment);
  if (batchId) {
    enrollmentFilter.batchId = batchId;
  }

  return enrollmentRepository.exists(enrollmentFilter);
};

const buildStudentEnrollmentAssessmentClauses = (enrollments = []) => {
  const clauses = [];
  const seen = new Set();

  enrollments.forEach((enrollment) => {
    const courseId = String(resolveRefId(enrollment.courseId) || '');
    const batchId = String(resolveRefId(enrollment.batchId) || '');
    if (!courseId) return;

    const key = `${courseId}:${batchId || 'course-wide'}`;
    if (seen.has(key)) return;
    seen.add(key);

    const batchScope = [{ batchId: null }, { batchId: { $exists: false } }];
    if (batchId) {
      batchScope.unshift({ batchId });
    }

    clauses.push({
      courseId,
      $or: batchScope,
    });
  });

  return clauses;
};

const buildAvailableAssessmentsFilterForEnrollments = (enrollments = [], now = new Date()) => {
  const enrollmentClauses = buildStudentEnrollmentAssessmentClauses(enrollments);
  if (enrollmentClauses.length === 0) {
    return { _id: null };
  }

  return {
    $and: [
      { status: 'published' },
      { $or: getPublishedAvailabilityClauses(now) },
      { $or: enrollmentClauses },
    ],
  };
};

module.exports = {
  buildAvailableAssessmentsFilterForEnrollments,
  buildInstructorAssessmentFilter,
  buildStudentEnrollmentAssessmentClauses,
  canInstructorAccessAssessment,
  canStudentAccessAssessment,
  getAssessmentBatchId,
  getAssessmentCourseId,
  getInstructorAssignmentScope,
  getPublishedAvailabilityClauses,
  isAssessmentScheduledNow,
};
