const { batchRepository, courseRepository, liveClassRepository, enrollmentRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const {
  toCanonicalTimezone,
  parseDateInput,
  addDaysToDateParts,
  compareDateParts,
  getDayNameForDateParts,
  zonedDateTimeToUtc,
  getDatePartsInTimezone
} = require('../utils/timezone');

/**
 * Get all batches with filtering
 */
const Enrollment = require("../models/Enrollment");
const { classScheduler } = require('../utils/liveClassScheduler');

const resolveValidTimezone = (candidate) => {
  return toCanonicalTimezone(candidate);
};

const detectClientTimezone = (req) => {
  const bodyTimezone = req.body?.schedule?.timezone;
  const headerTimezone =
    req.headers['x-client-timezone'] ||
    req.headers['x-timezone'] ||
    req.headers['timezone'];
  return (
    resolveValidTimezone(bodyTimezone) ||
    resolveValidTimezone(headerTimezone) ||
    'UTC'
  );
};

const getBatchNotificationRecipients = async (batchId, instructorId) => {
  const enrollments = await enrollmentRepository.find(
    { batchId, status: 'ENROLLED' },
    { select: 'studentId' }
  );

  return [
    instructorId?.toString?.() || instructorId,
    ...enrollments.map((enrollment) => enrollment.studentId?.toString())
  ].filter(Boolean);
};

const getBatches = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, courseId, status, instructorId } = req.query;
  const isAdmin = req.user?.roleId?.name === "ADMIN";

  const filters = {};
  if (courseId) filters.courseId = courseId;
  if (status) filters.status = status;
  if (instructorId) filters.instructorId = instructorId;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { path: "courseId", select: "title category" },
      { path: "instructorId", select: "firstName lastName email" },
      { path: "createdBy", select: "firstName lastName" }
    ]
  };

  const result = await batchRepository.paginate(filters, options);

  let batches = result.documents;

  // 🔥 Only for Admin → Add enrollmentCount
  if (isAdmin && batches.length > 0) {
    const batchIds = batches
    .map(batch => batch?._id || batch?.id)
    .filter(Boolean);

    const enrollmentCounts = await Enrollment.aggregate([
      {
        $match: {
          batchId: { $in: batchIds }
        }
      },
      {
        $group: {
          _id: "$batchId",
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to map for fast lookup
    const countMap = {};
    enrollmentCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Attach count to each batch
      batches = batches.map(batch => {
      const id = (batch?._id || batch?.id)?.toString();
      return {
        ...batch,
        enrollmentsCount: id ? (countMap[id] || 0) : 0
      };
    });
  }

  res.json({
    success: true,
    data: batches,
    pagination: result.pagination
  });
});


/**
 * Get single batch by ID
 */
const getBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const batch = await batchRepository.findById(id, {
    populate: [
      { path: 'courseId', select: 'title category description' },
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });
  
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  res.json({
    success: true,
    data: batch
  });
});

/**
 * Create new batch
 */
const createBatch = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Verify course exists
  const course = await courseRepository.findById(req.body.courseId);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  // Generate batch code if not provided
  const batchCode = req.body.batchCode || generateBatchCode();

  const batchData = {
    ...req.body,
    schedule: {
      ...(req.body?.schedule || {}),
      timezone: detectClientTimezone(req)
    },
    batchCode,
    createdBy: req.userId,
    currentEnrollment: 0,
    status: 'UPCOMING'
  };

  const batch = await batchRepository.create(batchData);

  await emailService.sendAdminEventEmail(
    'Batch created',
    `<p>A new batch has been created.</p>
     <p><strong>Name:</strong> ${batch.name || '-'}<br/>
     <strong>Course ID:</strong> ${batch.courseId?.toString?.() || batch.courseId || '-'}<br/>
     <strong>Timezone:</strong> ${batch.schedule?.timezone || 'UTC'}</p>`
  );

  if (req.body.scheduleClasses) {
    classScheduler(batch).catch(err => {
      console.error("Scheduler async error:", err);
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'Batch created successfully',
    data: batch
  });
});

/**
 * Update batch
 */
const updateBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const existingBatch = await batchRepository.findById(id);

  if (!existingBatch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  const previousSchedule = existingBatch.schedule || {};
  const incomingSchedule = updates?.schedule || {};
  const normalizedIncomingTimezone = incomingSchedule.timezone
    ? (resolveValidTimezone(incomingSchedule.timezone) || 'UTC')
    : undefined;

  const effectiveSchedule = {
    ...previousSchedule,
    ...incomingSchedule,
    ...(normalizedIncomingTimezone ? { timezone: normalizedIncomingTimezone } : {})
  };

  if (updates?.schedule) {
    updates.schedule = effectiveSchedule;
  }

  const scheduleFieldsChanged = Boolean(updates.schedule) && (
    effectiveSchedule.startTime !== previousSchedule.startTime ||
    effectiveSchedule.endTime !== previousSchedule.endTime ||
    effectiveSchedule.timezone !== previousSchedule.timezone
  );

  const batch = await batchRepository.updateById(id, updates);
  
  let rescheduledClasses = 0;
  if (batch && scheduleFieldsChanged) {
    const now = new Date();
    const upcomingClasses = await liveClassRepository.find({
      batchId: id,
      status: 'SCHEDULED',
      scheduledStartTime: { $gt: now }
    }, {
      sort: { scheduledStartTime: 1 }
    });

    const targetTimezone = resolveValidTimezone(effectiveSchedule.timezone) || 'UTC';
    const sourceTimezone = resolveValidTimezone(previousSchedule.timezone) || targetTimezone;
    const [newStartHour, newStartMinute] = String(effectiveSchedule.startTime || '00:00').split(':').map(Number);
    const [newEndHour, newEndMinute] = String(effectiveSchedule.endTime || '00:00').split(':').map(Number);

    for (const liveClass of upcomingClasses) {
      const dateParts = getDatePartsInTimezone(liveClass.scheduledStartTime, sourceTimezone);
      if (!dateParts) continue;

      const nextStart = zonedDateTimeToUtc(
        {
          year: dateParts.year,
          month: dateParts.month,
          day: dateParts.day,
          hour: newStartHour,
          minute: newStartMinute
        },
        targetTimezone
      );

      let nextEnd = zonedDateTimeToUtc(
        {
          year: dateParts.year,
          month: dateParts.month,
          day: dateParts.day,
          hour: newEndHour,
          minute: newEndMinute
        },
        targetTimezone
      );

      if (nextEnd <= nextStart) {
        nextEnd = new Date(nextEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      await liveClassRepository.updateById(liveClass.id || liveClass._id, {
        scheduledStartTime: nextStart,
        scheduledEndTime: nextEnd
      });
      rescheduledClasses += 1;
    }
  }

  res.json({
    success: true,
    message: scheduleFieldsChanged
      ? `Batch updated successfully. Rescheduled ${rescheduledClasses} upcoming classes.`
      : 'Batch updated successfully',
    meta: scheduleFieldsChanged
      ? { rescheduledUpcomingClasses: rescheduledClasses }
      : undefined,
    data: batch
  });
});

/**
 * Delete batch
 */
const deleteBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const batch = await batchRepository.findById(id);  
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  if(req.query.deleteClasses === "true"){
    let batchClasses = await liveClassRepository.deleteMany({batchId:id});
  }

  const deletedBatch = await batchRepository.deleteById(id);


  res.json({
    success: true,
    message: 'Batch deleted successfully'
  });
});

/**
 * Get batches by course
 */
const getBatchesByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const userId = req.userId;
  
  // const batches = await batchRepository.findByCourse(courseId);
  const enrollments = await enrollmentRepository.findByStudentAndCourse(userId, courseId);
  

  res.json({
    success: true,
    data: enrollments
  });
});

/*
* Get Batches By course For Students
*/
const getBatchesByCourseForStudents = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  
  const batches = await batchRepository.findByCourse(courseId);

  res.json({
    success: true,
    data: batches
  });
});

/**
 * Get batch statistics
 */
const getBatchStats = asyncHandler(async (req, res) => {
  const stats = await batchRepository.aggregate([
    {
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        upcomingBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'UPCOMING'] }, 1, 0] }
        },
        activeBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
        },
        completedBatches: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
        },
        totalEnrollments: { $sum: '$currentEnrollment' },
        averageEnrollment: { $avg: '$currentEnrollment' }
      }
    }
  ]);

  res.json({
    success: true,
    data: stats[0] || {
      totalBatches: 0,
      upcomingBatches: 0,
      activeBatches: 0,
      completedBatches: 0,
      totalEnrollments: 0,
      averageEnrollment: 0
    }
  });
});

/**
 * Enroll student in batch
 */
const enrollStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  const batch = await batchRepository.findById(id);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  if (batch.currentEnrollment >= batch.maxStudents) {
    return res.status(400).json({
      success: false,
      message: 'Batch is full'
    });
  }

  // Add enrollment logic here (create enrollment record)
  await batchRepository.updateById(id, {
    currentEnrollment: batch.currentEnrollment + 1
  });

  res.json({
    success: true,
    message: 'Student enrolled successfully'
  });
});

/**
 * Get scheduled classes for a batch
 */
const getBatchClasses = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const batch = await batchRepository.findById(id);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  let classes = await liveClassRepository.findByBatch(id);
  classes = await liveClassRepository.ensureRoomIds(classes);
  
  res.json({
    success: true,
    data: classes
  });
});

/**
 * Schedule a new class for a batch
 */
const scheduleClass = asyncHandler(async (req, res) => {
  const { id } = req.params; // batch id
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const batch = await batchRepository.findById(id);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // Create class data
  const classData = {
    ...req.body,
    batchId: id,
    instructorId: batch.instructorId, // Use batch instructor
    createdBy: req.userId,
    status: 'SCHEDULED',
    roomId: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  const scheduledClass = await liveClassRepository.create(classData);

  const recipients = await getBatchNotificationRecipients(id, batch.instructorId);
  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'CLASS_SCHEDULED',
    title: 'New live class scheduled',
    message: `${scheduledClass.title} has been scheduled.`,
    priority: 'normal',
    data: {
      classId: scheduledClass.id || scheduledClass._id?.toString(),
      batchId: id,
      roomId: scheduledClass.roomId,
      scheduledStartTime: scheduledClass.scheduledStartTime
    }
  });
  
  res.status(201).json({
    success: true,
    message: 'Class scheduled successfully',
    data: scheduledClass
  });
});

/**
 * Update a scheduled class
 */
const updateScheduledClass = asyncHandler(async (req, res) => {
  const { id, classId } = req.params;
  const updates = req.body;

  const scheduledClass = await liveClassRepository.updateById(classId, updates);
  
  if (!scheduledClass) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled class not found'
    });
  }

  res.json({
    success: true,
    message: 'Scheduled class updated successfully',
    data: scheduledClass
  });
});

/**
 * Delete a scheduled class
 */
const deleteScheduledClass = asyncHandler(async (req, res) => {
  const { id, classId } = req.params;
  
  const scheduledClass = await liveClassRepository.deleteById(classId);
  
  if (!scheduledClass) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled class not found'
    });
  }

  res.json({
    success: true,
    message: 'Scheduled class deleted successfully'
  });
});

/**
 * Cancel a scheduled class
 */
const cancelScheduledClass = asyncHandler(async (req, res) => {
  const { id, classId } = req.params;
  const { reason } = req.body;
  
  const scheduledClass = await liveClassRepository.findById(classId);
  if (!scheduledClass) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled class not found'
    });
  }

  await scheduledClass.cancelClass(reason, req.userId);

  const batch = await batchRepository.findById(id, { select: 'instructorId' });
  const recipients = await getBatchNotificationRecipients(id, batch?.instructorId);
  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'CLASS_CANCELLED',
    title: 'Live class cancelled',
    message: `${scheduledClass.title} has been cancelled.`,
    priority: 'high',
    data: {
      classId: scheduledClass.id || scheduledClass._id?.toString(),
      batchId: id,
      reason: reason || ''
    }
  });

  res.json({
    success: true,
    message: 'Scheduled class cancelled successfully',
    data: scheduledClass
  });
});

/**
 * Auto-generate classes for a batch based on schedule
 */
const autoGenerateClasses = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionDuration = 60, totalSessions } = req.body; // duration in minutes
  
  const batch = await batchRepository.findById(id);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  const generatedClasses = [];
  const startDate = parseDateInput(batch.startDate);
  const endDate = parseDateInput(batch.endDate);
  const scheduleDays = batch.schedule.days;
  const startTime = batch.schedule.startTime;
  const timezone = resolveValidTimezone(batch?.schedule?.timezone) || 'UTC';

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Batch has invalid start or end date'
    });
  }

  // Convert time strings to minutes for easier calculation
  const [startHour, startMinute] = startTime.split(':').map(Number);
  
  let sessionCount = 0;
  let currentDate = { ...startDate };

  while (compareDateParts(currentDate, endDate) <= 0 && (!totalSessions || sessionCount < totalSessions)) {
    const dayName = getDayNameForDateParts(currentDate);
    
    if (scheduleDays.includes(dayName)) {
      const classStartTime = zonedDateTimeToUtc(
        {
          year: currentDate.year,
          month: currentDate.month,
          day: currentDate.day,
          hour: startHour,
          minute: startMinute
        },
        timezone
      );
      
      const classEndTime = new Date(classStartTime);
      classEndTime.setMinutes(classEndTime.getMinutes() + sessionDuration);
      
      const classData = {
        title: `Session ${sessionCount + 1}`,
        batchId: id,
        instructorId: batch.instructorId,
        scheduledStartTime: classStartTime,
        scheduledEndTime: classEndTime,
        description: `Auto-generated session for ${batch.name}`,
        createdBy: req.userId,
        status: 'SCHEDULED',
        roomId: `room_${Date.now()}_${sessionCount}_${Math.random().toString(36).substr(2, 6)}`
      };

      const scheduledClass = await liveClassRepository.create(classData);
      generatedClasses.push(scheduledClass);
      sessionCount++;
    }
    
    // Move to next day
    currentDate = addDaysToDateParts(currentDate, 1);
  }

  const recipients = await getBatchNotificationRecipients(id, batch.instructorId);
  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'BATCH_AUTO_CLASSES_SCHEDULED',
    title: 'Class schedule generated',
    message: `${generatedClasses.length} classes were auto-scheduled for ${batch.name}.`,
    priority: 'normal',
    data: {
      batchId: id,
      generatedCount: generatedClasses.length
    }
  });

  res.json({
    success: true,
    message: `${generatedClasses.length} classes generated successfully`,
    data: generatedClasses
  });
});

/**
 * Helper function to generate batch code
 */
function generateBatchCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `BATCH-${date}-${random}`;
}

module.exports = {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchesByCourse,
  getBatchStats,
  enrollStudent,
  getBatchClasses,
  scheduleClass,
  updateScheduledClass,
  deleteScheduledClass,
  cancelScheduledClass,
  autoGenerateClasses,
  getBatchesByCourseForStudents
};
