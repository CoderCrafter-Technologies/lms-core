const { liveClassRepository, batchRepository, enrollmentRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');
const { enrichLiveClassesForStudent } = require('../services/liveClassAttendanceService');

/**
 * Get all live classes with filtering
 */
const getLiveClasses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, batchId, status, instructorId, date } = req.query;
  
  const filters = {};
  if (batchId) filters.batchId = batchId;
  if (status) filters.status = status;
  if (instructorId) filters.instructorId = instructorId;
  
  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    filters.scheduledStartTime = {
      $gte: startDate,
      $lt: endDate
    };
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { 
        path: 'batchId', 
        select: 'name batchCode',
        populate: { path: 'courseId', select: 'title' }
      },
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ],
    sort: { scheduledStartTime: 1 }
  };

  const result = await liveClassRepository.paginate(filters, options);
  
  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
});

/**
 * Get Classes With Filters
 * 
 */

const getLiveClassesByFilter = asyncHandler(async (req, res) => {
  try {
    const commonPopulate = [
      { path: 'batchId', select: 'name courseId' },
      { path: 'instructorId', select: 'firstName lastName email' }
    ];

    const upcomingClasses = await liveClassRepository.find(
      { status: { $in: ['SCHEDULED', 'LIVE'] } },
      { populate: commonPopulate, sort: { scheduledStartTime: 1 } }
    );

    const ongoingClasses = await liveClassRepository.find(
      { status: 'LIVE' },
      { populate: commonPopulate, sort: { scheduledStartTime: 1 } }
    );

    const pastClasses = await liveClassRepository.find(
      { status: 'ENDED' },
      { populate: commonPopulate, sort: { scheduledStartTime: 1 } }
    );

    return res.json({
      success: true,
      data: { upcomingClasses : upcomingClasses || [], ongoingClasses : ongoingClasses || [], pastClasses : pastClasses || [] }
    });
  } catch (err) {
    console.error("Error fetching live classes by filter:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch live classes"
    });
  }
});




/**
 * Get single live class by ID
 */
const getLiveClass = asyncHandler(async (req, res) => {
  console.log(req.params.id, "Requested Live Class ID")
  const { id } = req.params;
  
  const liveClass = await liveClassRepository.findById(id, {
    populate: [
      { 
        path: 'batchId', 
        select: 'name batchCode courseId',
        populate: { path: 'courseId', select: 'title description' }
      },
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    data: liveClass
  });
});


/**
 * Get single live class by ID
 */
const getLiveClassByRoomId = asyncHandler(async (req, res) => {
  console.log(req.params.roomId, "Requested Live Class By Room ID")
  const { roomId } = req.params;
  
  const liveClass = await liveClassRepository.findOne({roomId: roomId}, {
    populate: [
      { 
        path: 'batchId', 
        select: 'name batchCode courseId',
        populate: { path: 'courseId', select: 'title description' }
      },
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    data: liveClass
  }).status(200);
});



/**
 * Create new live class
 */
const createLiveClass = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Verify batch exists
  const batch = await batchRepository.findById(req.body.batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // Generate room ID
  const roomId = generateRoomId();

  const liveClassData = {
    ...req.body,
    roomId,
    instructorId: req.body.instructorId || req.userId,
    createdBy: req.userId,
    status: 'SCHEDULED',
    stats: {
      totalParticipants: 0,
      peakParticipants: 0,
      averageParticipants: 0,
      totalChatMessages: 0
    },
    recording: {
      isRecorded: false,
      recordingUrl: null,
      recordingId: null,
      recordingSize: 0,
      recordingDuration: 0
    }
  };

  const liveClass = await liveClassRepository.create(liveClassData);

  const enrollments = await enrollmentRepository.find(
    { batchId: req.body.batchId, status: 'ENROLLED' },
    { select: 'studentId' }
  );
  const recipients = [
    liveClass.instructorId?.toString?.() || liveClass.instructorId,
    ...enrollments.map((enrollment) => enrollment.studentId?.toString())
  ].filter(Boolean);

  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'CLASS_SCHEDULED',
    title: 'New live class scheduled',
    message: `${liveClass.title} has been scheduled.`,
    priority: 'normal',
    data: {
      classId: liveClass.id || liveClass._id?.toString(),
      batchId: req.body.batchId,
      roomId: liveClass.roomId,
      scheduledStartTime: liveClass.scheduledStartTime
    }
  });
  
  res.status(201).json({
    success: true,
    message: 'Live class scheduled successfully',
    data: liveClass
  });
});

/**
 * Update live class
 */
const updateLiveClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const liveClass = await liveClassRepository.updateById(id, updates);
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    message: 'Live class updated successfully',
    data: liveClass
  });
});

/**
 * Delete live class
 */
const deleteLiveClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const liveClass = await liveClassRepository.deleteById(id);
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    message: 'Live class deleted successfully'
  });
});

/**
 * Start live class
 */
const startLiveClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const liveClass = await liveClassRepository.updateById(id, {
    status: 'LIVE',
    actualStartTime: new Date()
  });
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    message: 'Live class started successfully',
    data: liveClass
  });
});

/**
 * End live class
 */
const endLiveClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const liveClass = await liveClassRepository.updateById(id, {
    status: 'ENDED',
    actualEndTime: new Date()
  });
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  res.json({
    success: true,
    message: 'Live class ended successfully',
    data: liveClass
  });
});

/**
 * Cancel live class
 */
const cancelLiveClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const liveClass = await liveClassRepository.updateById(id, {
    status: 'CANCELLED',
    cancellationReason: reason,
    cancelledBy: req.userId,
    cancelledAt: new Date()
  });
  
  if (!liveClass) {
    return res.status(404).json({
      success: false,
      message: 'Live class not found'
    });
  }

  const enrollments = await enrollmentRepository.find(
    { batchId: liveClass.batchId, status: 'ENROLLED' },
    { select: 'studentId' }
  );
  const recipients = [
    liveClass.instructorId?.toString?.() || liveClass.instructorId,
    ...enrollments.map((enrollment) => enrollment.studentId?.toString())
  ].filter(Boolean);

  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'CLASS_CANCELLED',
    title: 'Live class cancelled',
    message: `${liveClass.title} has been cancelled.`,
    priority: 'high',
    data: {
      classId: liveClass.id || liveClass._id?.toString(),
      batchId: liveClass.batchId?.toString?.() || liveClass.batchId,
      reason: reason || ''
    }
  });

  res.json({
    success: true,
    message: 'Live class cancelled successfully',
    data: liveClass
  });
});

/**
 * Get live classes by batch
 */
const getLiveClassesByBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  
  const liveClasses = await liveClassRepository.findByBatch(batchId);
  const classItems = liveClasses.map((liveClass) => (
    typeof liveClass.toObject === 'function' ? liveClass.toObject() : liveClass
  ));

  const data = req.userRole === 'student'
    ? enrichLiveClassesForStudent(classItems, req.userId)
    : classItems;
  
  res.json({
    success: true,
    data
  });
});

/**
 * Get live class statistics
 */
const getLiveClassStats = asyncHandler(async (req, res) => {
  const stats = await liveClassRepository.aggregate([
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        scheduledClasses: {
          $sum: { $cond: [{ $eq: ['$status', 'SCHEDULED'] }, 1, 0] }
        },
        liveClasses: {
          $sum: { $cond: [{ $eq: ['$status', 'LIVE'] }, 1, 0] }
        },
        endedClasses: {
          $sum: { $cond: [{ $eq: ['$status', 'ENDED'] }, 1, 0] }
        },
        cancelledClasses: {
          $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
        },
        totalParticipants: { $sum: '$stats.totalParticipants' },
        averageParticipants: { $avg: '$stats.averageParticipants' }
      }
    }
  ]);

  res.json({
    success: true,
    data: stats[0] || {
      totalClasses: 0,
      scheduledClasses: 0,
      liveClasses: 0,
      endedClasses: 0,
      cancelledClasses: 0,
      totalParticipants: 0,
      averageParticipants: 0
    }
  });
});

/**
 * Helper function to generate room ID
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  getLiveClasses,
  getLiveClass,
  createLiveClass,
  updateLiveClass,
  deleteLiveClass,
  startLiveClass,
  endLiveClass,
  cancelLiveClass,
  getLiveClassesByBatch,
  getLiveClassStats,
  getLiveClassByRoomId,
  getLiveClassesByFilter
};
