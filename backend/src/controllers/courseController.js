const { courseRepository, userRepository, batchRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const { Batch, LiveClass, Course, Enrollment, PastEnrollment } = require('../models');
const CourseRepository = require('../repositories/CourseRepository');
const emailService = require('../services/emailService');

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const parseNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const getNextCurriculumVersion = (course) => {
  const versions = Array.isArray(course.curriculumVersions) ? course.curriculumVersions : [];
  const maxVersion = versions.reduce((max, item) => Math.max(max, Number(item.versionNumber || 0)), 0);
  return Math.max(1, maxVersion + 1);
};

const toSafeStringId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'object' && value.id) return String(value.id);
  try {
    return value.toString();
  } catch {
    return null;
  }
};

const buildPastEnrollmentSnapshot = ({ enrollment, courseById, batchById, userById, deletedBy }) => {
  const studentId = toSafeStringId(enrollment.studentId);
  const batchId = toSafeStringId(enrollment.batchId);
  const courseId = toSafeStringId(enrollment.courseId);
  const enrolledById = toSafeStringId(enrollment.enrolledBy);

  const student = userById.get(studentId) || {};
  const batch = batchById.get(batchId) || {};
  const course = courseById.get(courseId) || {};
  const enrolledBy = userById.get(enrolledById) || {};

  return {
    originalEnrollmentId: toSafeStringId(enrollment._id) || '',
    deletedAt: new Date(),
    deletedBy: deletedBy || null,
    deleteReason: 'COURSE_DELETED',
    student: {
      id: studentId,
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: student.email || '',
      phone: student.phone || ''
    },
    course: {
      id: courseId,
      title: course.title || '',
      slug: course.slug || '',
      category: course.category || '',
      level: course.level || '',
      status: course.status || ''
    },
    batch: {
      id: batchId,
      name: batch.name || '',
      batchCode: batch.batchCode || '',
      startDate: batch.startDate || null,
      endDate: batch.endDate || null,
      schedule: batch.schedule || {},
      status: batch.status || '',
      instructorId: toSafeStringId(batch.instructorId)
    },
    enrolledBy: {
      id: enrolledById,
      firstName: enrolledBy.firstName || '',
      lastName: enrolledBy.lastName || '',
      email: enrolledBy.email || ''
    },
    enrollmentDate: enrollment.enrollmentDate,
    status: enrollment.status,
    progress: enrollment.progress || {},
    attendance: enrollment.attendance || {},
    grades: enrollment.grades || {},
    payment: enrollment.payment || {},
    completedAt: enrollment.completedAt || null,
    certificate: enrollment.certificate || {},
    notes: enrollment.notes || '',
    enrollmentSnapshot: enrollment
  };
};

/**
 * Get all courses with filtering and pagination
 */
const getCourses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, category, level, status, search } = req.query;
  const isAdmin = req.user.roleId.name === "ADMIN";
  console.log("ADMIN REQUESTED CODER API GET COURSES", req.user.roleId.name);
  const filters = {};
  if (category) filters.category = category;
  if (level) filters.level = level;
  if (status) filters.status = status;
  if (search) {
    filters.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: { path: 'createdBy', select: 'firstName lastName email' }
  };

  if (isAdmin) {
    
      const courses = await Course.aggregate([
      { $match: filters },

      {
        $lookup: {
          from: "batches", // collection name in Mongo
          localField: "_id",
          foreignField: "courseId",
          as: "batches"
        }
      },

      {
        $sort: { createdAt: -1 }
      },

      {
        $skip: (page - 1) * limit
      },

      {
        $limit: parseInt(limit)
      }
    ]);

    const total = await Course.countDocuments(filters);

    return res.json({
      success: true,
      data: courses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  }

  const result = await courseRepository.paginate(filters, options);
  
  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
});

/**
 * Get single course by ID
 */
const getCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const course = await courseRepository.findById(id, {
    populate: { path: 'createdBy', select: 'firstName lastName email' }
  });
  
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    data: course
  });
});

/**
 * Create new course
 */
const createCourse = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const courseData = {
    title: req.body.title,
    description: req.body.description,
    shortDescription: req.body.shortDescription || '',
    category: req.body.category,
    level: req.body.level,
    pricing: {
      type: req.body['pricing.type'] || req.body?.pricing?.type || 'FREE',
      amount: parseNumber(req.body['pricing.amount'] || req.body?.pricing?.amount, 0),
      currency: req.body['pricing.currency'] || req.body?.pricing?.currency || 'USD'
    },
    estimatedDuration: {
      hours: parseNumber(req.body['estimatedDuration.hours'] || req.body?.estimatedDuration?.hours, 0),
      minutes: parseNumber(req.body['estimatedDuration.minutes'] || req.body?.estimatedDuration?.minutes, 0)
    },
    tags: parseArray(req.body.tags),
    isPublic: parseBoolean(req.body.isPublic, true),
    thumbnail: req.file
      ? {
          url: `/uploads/courses/${req.file.filename}`,
          publicId: req.file.filename
        }
      : undefined,
    createdBy: req.userId,
    slug: generateSlug(req.body.title),
    status: 'DRAFT'
  };

  const course = await courseRepository.create(courseData);
  await emailService.sendAdminEventEmail(
    'Course created',
    `<p>A new course has been created.</p>
     <p><strong>Title:</strong> ${course.title || '-'}<br/>
     <strong>Category:</strong> ${course.category || '-'}<br/>
     <strong>Level:</strong> ${course.level || '-'}</p>`
  );
  
  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: course
  });
});

/**
 * Update course
 */
const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  if (req.body['pricing.type'] || req.body['pricing.amount'] || req.body['pricing.currency']) {
    updates.pricing = {
      type: req.body['pricing.type'] || req.body?.pricing?.type || 'FREE',
      amount: parseNumber(req.body['pricing.amount'] || req.body?.pricing?.amount, 0),
      currency: req.body['pricing.currency'] || req.body?.pricing?.currency || 'USD'
    };
  }

  if (req.body['estimatedDuration.hours'] || req.body['estimatedDuration.minutes']) {
    updates.estimatedDuration = {
      hours: parseNumber(req.body['estimatedDuration.hours'] || req.body?.estimatedDuration?.hours, 0),
      minutes: parseNumber(req.body['estimatedDuration.minutes'] || req.body?.estimatedDuration?.minutes, 0)
    };
  }

  if (typeof req.body.tags !== 'undefined') {
    updates.tags = parseArray(req.body.tags);
  }

  if (typeof req.body.isPublic !== 'undefined') {
    updates.isPublic = parseBoolean(req.body.isPublic, true);
  }

  if (req.file) {
    updates.thumbnail = {
      url: `/uploads/courses/${req.file.filename}`,
      publicId: req.file.filename
    };
  }

  // Generate new slug if title is updated
  if (updates.title) {
    updates.slug = generateSlug(updates.title);
  }

  // Set published date when status changes to published
  if (updates.status === 'PUBLISHED') {
    const existingCourse = await courseRepository.findById(id);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (
      existingCourse.authoringWorkflow?.approvalRequired &&
      existingCourse.authoringWorkflow?.stage !== 'APPROVED'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Course must be approved before publishing'
      });
    }

    updates.publishedAt = new Date();
  }

  const course = await courseRepository.updateById(id, updates);
  
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    message: 'Course updated successfully',
    data: course
  });
});

/**
 * Delete course
 */
const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id).lean();
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  const batches = await Batch.find({ courseId: id }).lean();
  const batchIds = batches.map((batch) => batch._id);

  const enrollmentQuery = {
    $or: [
      { courseId: id },
      ...(batchIds.length > 0 ? [{ batchId: { $in: batchIds } }] : [])
    ]
  };
  const enrollments = await Enrollment.find(enrollmentQuery).lean();

  let archivedEnrollmentsCount = 0;
  if (enrollments.length > 0) {
    const uniqueUserIds = [
      ...new Set(
        enrollments.flatMap((enrollment) => [
          toSafeStringId(enrollment.studentId),
          toSafeStringId(enrollment.enrolledBy)
        ]).filter(Boolean)
      )
    ];

    const users = uniqueUserIds.length > 0
      ? await userRepository.find(
          { _id: { $in: uniqueUserIds } },
          { select: 'firstName lastName email phone' }
        )
      : [];

    const courseById = new Map([[toSafeStringId(course._id), course]]);
    const batchById = new Map(batches.map((batch) => [toSafeStringId(batch._id), batch]));
    const userById = new Map(
      users.map((user) => {
        const raw = user.toObject ? user.toObject() : user;
        return [toSafeStringId(raw._id || raw.id), raw];
      })
    );

    const snapshots = enrollments.map((enrollment) => buildPastEnrollmentSnapshot({
      enrollment,
      courseById,
      batchById,
      userById,
      deletedBy: req.userId ? String(req.userId) : null
    }));

    await PastEnrollment.insertMany(snapshots, { ordered: false });
    archivedEnrollmentsCount = snapshots.length;
  }

  const [classResult, enrollmentResult, batchResult, deletedCourse] = await Promise.all([
    batchIds.length > 0
      ? LiveClass.deleteMany({ batchId: { $in: batchIds } })
      : Promise.resolve({ deletedCount: 0 }),
    Enrollment.deleteMany(enrollmentQuery),
    Batch.deleteMany({ courseId: id }),
    courseRepository.deleteById(id)
  ]);

  if (!deletedCourse) {
    return res.status(500).json({
      success: false,
      message: 'Course deletion failed'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Course and related data deleted successfully',
    data: {
      courseId: id,
      deleted: {
        batches: batchResult.deletedCount || 0,
        liveClasses: classResult.deletedCount || 0,
        enrollments: enrollmentResult.deletedCount || 0
      },
      archived: {
        pastEnrollments: archivedEnrollmentsCount
      }
    }
  });
});

/**
 * Get course statistics
 */
const getCourseStats = asyncHandler(async (req, res) => {
  const stats = await courseRepository.aggregate([
    {
      $group: {
        _id: null,
        totalCourses: { $sum: 1 },
        publishedCourses: {
          $sum: { $cond: [{ $eq: ['$status', 'PUBLISHED'] }, 1, 0] }
        },
        draftCourses: {
          $sum: { $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0] }
        },
        averagePrice: { $avg: '$pricing.amount' },
        totalEnrollments: { $sum: '$enrollmentCount' }
      }
    }
  ]);

  const categoryStats = await courseRepository.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: stats[0] || {
        totalCourses: 0,
        publishedCourses: 0,
        draftCourses: 0,
        averagePrice: 0,
        totalEnrollments: 0
      },
      byCategory: categoryStats
    }
  });
});

/**
 * Publish course
 */
const publishCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingCourse = await courseRepository.findById(id);
  if (!existingCourse) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  if (
    existingCourse.authoringWorkflow?.approvalRequired &&
    existingCourse.authoringWorkflow?.stage !== 'APPROVED'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Course must be approved before publishing'
    });
  }

  const course = await courseRepository.updateById(id, {
    status: 'PUBLISHED',
    publishedAt: new Date()
  });
  
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    message: 'Course published successfully',
    data: course
  });
});

/**
 * Submit course for review
 */
const submitCourseForReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes = '' } = req.body;

  const course = await courseRepository.updateById(id, {
    'authoringWorkflow.stage': 'IN_REVIEW',
    'authoringWorkflow.submittedForReviewAt': new Date(),
    'authoringWorkflow.submittedBy': req.userId,
    'authoringWorkflow.reviewedAt': null,
    'authoringWorkflow.reviewedBy': null,
    'authoringWorkflow.reviewNotes': String(reviewNotes || '')
  });

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    message: 'Course submitted for review',
    data: course
  });
});

/**
 * Approve course review
 */
const approveCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes = '' } = req.body;

  const course = await courseRepository.updateById(id, {
    'authoringWorkflow.stage': 'APPROVED',
    'authoringWorkflow.reviewedAt': new Date(),
    'authoringWorkflow.reviewedBy': req.userId,
    'authoringWorkflow.reviewNotes': String(reviewNotes || '')
  });

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    message: 'Course approved',
    data: course
  });
});

/**
 * Reject course review
 */
const rejectCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes = '' } = req.body;

  const course = await courseRepository.updateById(id, {
    'authoringWorkflow.stage': 'REJECTED',
    'authoringWorkflow.reviewedAt': new Date(),
    'authoringWorkflow.reviewedBy': req.userId,
    'authoringWorkflow.reviewNotes': String(reviewNotes || '')
  });

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    message: 'Course rejected',
    data: course
  });
});

/**
 * Create a curriculum version snapshot
 */
const createCurriculumVersion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    label = '',
    changeSummary = '',
    curriculum = null,
    workflowStage = 'DRAFT',
    activate = false
  } = req.body;

  const course = await courseRepository.findById(id);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  const versionNumber = getNextCurriculumVersion(course);
  const snapshotCurriculum = curriculum || course.curriculum || { modules: [] };

  const nextVersions = Array.isArray(course.curriculumVersions)
    ? [...course.curriculumVersions]
    : [];

  if (activate) {
    for (let i = 0; i < nextVersions.length; i += 1) {
      nextVersions[i].isActive = false;
    }
  }

  const version = {
    versionNumber,
    label: String(label || `v${versionNumber}`),
    changeSummary: String(changeSummary || ''),
    workflowStage,
    curriculum: snapshotCurriculum,
    createdBy: req.userId,
    isActive: Boolean(activate)
  };

  if (workflowStage === 'APPROVED') {
    version.approvedBy = req.userId;
    version.approvedAt = new Date();
  }

  nextVersions.push(version);

  const updates = {
    curriculum: snapshotCurriculum,
    curriculumVersions: nextVersions
  };

  if (activate) {
    updates.activeCurriculumVersion = versionNumber;
  }

  const updated = await courseRepository.updateById(id, updates);

  res.status(201).json({
    success: true,
    message: 'Curriculum version created',
    data: {
      courseId: id,
      versionNumber,
      activeCurriculumVersion: updated.activeCurriculumVersion,
      version
    }
  });
});

/**
 * List curriculum versions
 */
const listCurriculumVersions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await courseRepository.findById(id, {
    select: 'title activeCurriculumVersion curriculumVersions'
  });

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  const versions = (course.curriculumVersions || []).sort(
    (a, b) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0)
  );

  res.json({
    success: true,
    data: {
      courseId: id,
      title: course.title,
      activeCurriculumVersion: course.activeCurriculumVersion || null,
      versions
    }
  });
});

/**
 * Activate a curriculum version
 */
const activateCurriculumVersion = asyncHandler(async (req, res) => {
  const { id, versionNumber } = req.params;
  const numericVersion = Number(versionNumber);

  if (!Number.isFinite(numericVersion) || numericVersion <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid versionNumber is required'
    });
  }

  const course = await courseRepository.findById(id);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  const versions = Array.isArray(course.curriculumVersions)
    ? [...course.curriculumVersions]
    : [];
  const selected = versions.find((item) => Number(item.versionNumber) === numericVersion);

  if (!selected) {
    return res.status(404).json({
      success: false,
      message: 'Curriculum version not found'
    });
  }

  for (let i = 0; i < versions.length; i += 1) {
    versions[i].isActive = Number(versions[i].versionNumber) === numericVersion;
  }

  const updated = await courseRepository.updateById(id, {
    activeCurriculumVersion: numericVersion,
    curriculum: selected.curriculum || { modules: [] },
    curriculumVersions: versions
  });

  res.json({
    success: true,
    message: 'Curriculum version activated',
    data: {
      courseId: id,
      activeCurriculumVersion: updated.activeCurriculumVersion,
      curriculum: updated.curriculum
    }
  });
});

/**
 * Get batches for a course
 */
const getCourseBatches = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const course = await courseRepository.findById(id);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  const batches = await batchRepository.find({ courseId: id }, {
    populate: [
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ],
    sort: { startDate: -1 }
  });

  res.json({
    success: true,
    data: {
      course: {
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level
      },
      batches
    }
  });
});

/**
 * Helper function to generate slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStats,
  publishCourse,
  getCourseBatches,
  submitCourseForReview,
  approveCourse,
  rejectCourse,
  createCurriculumVersion,
  listCurriculumVersions,
  activateCurriculumVersion
};
