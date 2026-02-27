const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const User = require('../models/User');
const {asyncHandler} = require('../middleware/errorHandler');
const ErrorResponse = require('../utils/errorResponse');
const emailService = require('../services/emailService');
const { roleRepository, courseRepository, liveClassRepository } = require('../repositories');
const { syncEnrollmentProgress, syncEnrollmentsProgress } = require('../services/enrollmentProgressService');

// @desc    Get all enrollments
// @route   GET /api/v1/enrollments
// @access  Private/Admin
exports.getAllEnrollments = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});


// @desc    Get all enrollments
// @route   GET /api/v1/enrollments
// @access  Private/Admin
exports.getMyEnrollments = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({ studentId: req.userId })
    .populate('courseId', 'title slug thumbnail')
    .populate('batchId', 'name batchCode schedule')
    .populate('enrolledBy', 'firstName lastName');

  await syncEnrollmentsProgress(enrollments);

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments
  });
});

// @desc    Get single enrollment
// @route   GET /api/v1/enrollments/:id
// @access  Private/Admin
exports.getEnrollment = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id)
    .populate('studentId', 'firstName lastName email avatar')
    .populate('courseId', 'title slug thumbnail')
    .populate('batchId', 'name batchCode schedule')
    .populate('enrolledBy', 'firstName lastName');

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  await syncEnrollmentProgress(enrollment);

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Create new enrollment
// @route   POST /api/v1/enrollments
// @access  Private/Admin
exports.createEnrollment = asyncHandler(async (req, res, next) => {
  console.log("ENROLLMENT POST TRIGGERED")
  try{
      // Check if student exists
  const student = await User.findById(req.body.studentId);
  const studentRole = await roleRepository.findOne({name: 'STUDENT'});
    console.log({roleResponse: studentRole.id, bodyStudent: student.roleId}, "Student In Create Enrollment")

  if (!student || !student.roleId.equals(studentRole.id)) {
    return next(
      new ErrorResponse(`Student not found with id of ${req.body.studentId}`, 404)
    );
  }

  // Check if course exists
  const course = await Course.findById(req.body.courseId);
  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id of ${req.body.courseId}`, 404)
    );
  }

  // Check if batch exists and belongs to the course
  const batch = await Batch.findOne({
    _id: req.body.batchId,
    courseId: req.body.courseId
  });
  if (!batch) {
    return next(
      new ErrorResponse(`Batch not found or doesn't belong to the course`, 404)
    );
  };

  const totalClasses = await liveClassRepository.find({batchId: batch.id});

  // Check if batch has available seats
  if (batch.currentEnrollment >= batch.maxStudents) {
    return next(
      new ErrorResponse(`Batch ${batch.name} is already full`, 400)
    );
  }

  // Check if student is already enrolled in this batch
  const existingBatchEnrollment = await Enrollment.findOne({
    studentId: req.body.studentId,
    batchId: req.body.batchId
  });
  if (existingBatchEnrollment) {
    return next(
      new ErrorResponse(`Student is already enrolled in this batch`, 400)
    );
  }

  // Check if student is already enrolled in any active batch of the same course
  const existingCourseEnrollments = await Enrollment.find({
    studentId: req.body.studentId,
    courseId: req.body.courseId,
    status: { $in: ['ENROLLED'] } // Only check active enrollments
  }).populate('batchId', 'name batchCode status');

  const activeEnrollments = existingCourseEnrollments.filter(enrollment => 
    enrollment.batchId && 
    ['ACTIVE', 'ONGOING'].includes(enrollment.batchId.status)
  );

  if (activeEnrollments.length > 0) {
    const activeBatchNames = activeEnrollments.map(e => e.batchId.name).join(', ');
    return next(
      new ErrorResponse(
        `Student is already enrolled in an active batch (${activeBatchNames}) of this course. A student can only be enrolled in one active batch per course.`, 
        400
      )
    );
  }

  // Set enrolledBy to current user
  req.body.enrolledBy = req.user.id;

    // Create enrollment
    const enrollment = await Enrollment.create({...req.body, progress: {totalClasses: totalClasses.length}});

    // Update batch enrollment count
    batch.currentEnrollment += 1;
    await batch.save();

    // Update course enrollment count
    course.enrollmentCount += 1;
    await course.save();
    res.status(201).json({
    success: true,
    data: enrollment
  });

   emailService.sendEnrollmentConfirmation({
      studentEmail: student.email,
      studentName: `${student.firstName} ${student.lastName}`,
      courseName: course.title,
      batchName: batch.name,
      batchSchedule: batch.schedule,
      startDate: batch.startDate,
      paymentStatus: enrollment.payment.status,
      amountPaid: enrollment.payment.amount
    });
  }catch(err){
    res.status(400).json(err)
  }
});

// @desc    Update enrollment
// @route   PUT /api/v1/enrollments/:id
// @access  Private/Admin
exports.updateEnrollment = asyncHandler(async (req, res, next) => {
  let enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  // Prevent changing student, course or batch after enrollment
  if (req.body.studentId || req.body.courseId || req.body.batchId) {
    return next(
      new ErrorResponse(`Cannot change student, course or batch after enrollment`, 400)
    );
  }

  // Handle status changes
  if (req.body.status === 'COMPLETED' && enrollment.status !== 'COMPLETED') {
    req.body.completedAt = new Date();
  }

  enrollment = await Enrollment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Delete enrollment
// @route   DELETE /api/v1/enrollments/:id
// @access  Private/Admin
exports.deleteEnrollment = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  // Get batch and course to update counts
  const batch = await Batch.findById(enrollment.batchId);
  const course = await Course.findById(enrollment.courseId);

  await Enrollment.findByIdAndDelete(req.params.id);

  // Update batch enrollment count
  if (batch) {
    batch.currentEnrollment = Math.max(0, batch.currentEnrollment - 1);
    await batch.save();
  }

  // Update course enrollment count
  if (course) {
    course.enrollmentCount = Math.max(0, course.enrollmentCount - 1);
    await course.save();
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get enrollments by student
// @route   GET /api/v1/enrollments/student/:studentId
// @access  Private/Admin
exports.getEnrollmentsByStudent = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({ studentId: req.params.studentId })
    .populate('courseId', 'title slug thumbnail category level shortDescription')
    .populate('batchId', 'name batchCode startDate endDate status')
    .sort({ enrollmentDate: -1 });

  await syncEnrollmentsProgress(enrollments);

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments
  });
});

// @desc    Get enrollments by course
// @route   GET /api/v1/enrollments/course/:courseId
// @access  Private/Admin
exports.getEnrollmentsByCourse = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({ courseId: req.params.courseId })
    .populate('studentId', 'firstName lastName email avatar')
    .populate('batchId', 'name batchCode')
    .sort({ enrollmentDate: -1 });

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments
  });
});

// @desc    Get enrollments by batch
// @route   GET /api/v1/enrollments/batch/:batchId
// @access  Private/Admin
exports.getEnrollmentsByBatch = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({ batchId: req.params.batchId })
    .populate('studentId', 'firstName lastName email phone avatar')
    .populate('courseId', 'title slug')
    .sort({ enrollmentDate: -1 });

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments
  });
});

// @desc    Update enrollment progress
// @route   PUT /api/v1/enrollments/:id/progress
// @access  Private/Admin
exports.updateEnrollmentProgress = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  const { completedClasses, totalClasses } = req.body;

  enrollment.progress.completedClasses = completedClasses;
  enrollment.progress.totalClasses = totalClasses;
  await enrollment.save();

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Update enrollment attendance
// @route   PUT /api/v1/enrollments/:id/attendance
// @access  Private/Admin
exports.updateEnrollmentAttendance = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  const { attendedClasses, totalClasses } = req.body;

  enrollment.attendance.attendedClasses = attendedClasses;
  enrollment.attendance.totalClasses = totalClasses;
  await enrollment.save();

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Add grade to enrollment
// @route   POST /api/v1/enrollments/:id/grades
// @access  Private/Admin
exports.addEnrollmentGrade = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  const { title, score, maxScore } = req.body;

  enrollment.grades.assignments.push({
    title,
    score,
    maxScore,
    submittedAt: new Date()
  });

  // Recalculate final grade
  const totalScore = enrollment.grades.assignments.reduce((sum, grade) => sum + grade.score, 0);
  const totalMaxScore = enrollment.grades.assignments.reduce((sum, grade) => sum + grade.maxScore, 0);
  
  if (totalMaxScore > 0) {
    enrollment.grades.finalScore = Math.round((totalScore / totalMaxScore) * 100);
  }

  await enrollment.save();

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Complete enrollment
// @route   PUT /api/v1/enrollments/:id/complete
// @access  Private/Admin
exports.completeEnrollment = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  enrollment.status = 'COMPLETED';
  enrollment.completedAt = new Date();
  await enrollment.save();

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Issue certificate for enrollment
// @route   POST /api/v1/enrollments/:id/certificate
// @access  Private/Admin
exports.issueCertificate = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id)
    .populate('studentId', 'firstName lastName email')
    .populate('courseId', 'title');

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  if (enrollment.status !== 'COMPLETED') {
    return next(
      new ErrorResponse(`Enrollment must be completed before issuing certificate`, 400)
    );
  }

  enrollment.certificate.issued = true;
  enrollment.certificate.issuedAt = new Date();
  enrollment.certificate.certificateUrl = req.body.certificateUrl;
  await enrollment.save();

  // Send certificate email
  try {
    await emailService.sendCertificateIssued({
      studentEmail: enrollment.studentId.email,
      studentName: `${enrollment.studentId.firstName} ${enrollment.studentId.lastName}`,
      courseName: enrollment.courseId.title,
      certificateUrl: enrollment.certificate.certificateUrl
    });
  } catch (err) {
    console.error('Error sending certificate email:', err);
  }

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Update enrollment payment
// @route   PUT /api/v1/enrollments/:id/payment
// @access  Private/Admin
exports.updateEnrollmentPayment = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findById(req.params.id);

  if (!enrollment) {
    return next(
      new ErrorResponse(`Enrollment not found with id of ${req.params.id}`, 404)
    );
  }

  const { status, amount, transactionId } = req.body;

  enrollment.payment.status = status || enrollment.payment.status;
  enrollment.payment.amount = amount || enrollment.payment.amount;
  
  if (status === 'PAID') {
    enrollment.payment.paidAt = new Date();
    enrollment.payment.transactionId = transactionId;
  }

  await enrollment.save();

  res.status(200).json({
    success: true,
    data: enrollment
  });
});

// @desc    Student self-enrollment
// @route   POST /api/v1/enrollments/self-enroll
// @access  Private/Student
exports.selfEnroll = asyncHandler(async (req, res, next) => {
  const studentId = req.user.id;
  const { courseId, batchId } = req.body;

  // Verify student role
  const studentRole = await roleRepository.findOne({name: 'STUDENT'});
  if (!req.user.roleId.equals(studentRole.id)) {
    return next(
      new ErrorResponse(`Only students can self-enroll`, 403)
    );
  }

  // Check if course exists and is available for enrollment
  const course = await Course.findById(courseId);
  if (!course || course.status !== 'published') {
    return next(
      new ErrorResponse(`Course not found or not available for enrollment`, 404)
    );
  }

  // Check if batch exists, belongs to the course, and is accepting enrollments
  const batch = await Batch.findOne({
    _id: batchId,
    courseId: courseId,
    status: { $in: ['ACTIVE', 'SCHEDULED'] }
  });
  if (!batch) {
    return next(
      new ErrorResponse(`Batch not found, doesn't belong to the course, or is not accepting enrollments`, 404)
    );
  }

  // Check if batch has available seats
  if (batch.currentEnrollment >= batch.maxStudents) {
    return next(
      new ErrorResponse(`Batch ${batch.name} is already full`, 400)
    );
  }

  // Check if student is already enrolled in this batch
  const existingBatchEnrollment = await Enrollment.findOne({
    studentId: studentId,
    batchId: batchId
  });
  if (existingBatchEnrollment) {
    return next(
      new ErrorResponse(`You are already enrolled in this batch`, 400)
    );
  }

  // Check if student is already enrolled in any active batch of the same course
  const existingCourseEnrollments = await Enrollment.find({
    studentId: studentId,
    courseId: courseId,
    status: { $in: ['ENROLLED'] }
  }).populate('batchId', 'name batchCode status');

  const activeEnrollments = existingCourseEnrollments.filter(enrollment => 
    enrollment.batchId && 
    ['ACTIVE', 'ONGOING'].includes(enrollment.batchId.status)
  );

  if (activeEnrollments.length > 0) {
    const activeBatchNames = activeEnrollments.map(e => e.batchId.name).join(', ');
    return next(
      new ErrorResponse(
        `You are already enrolled in an active batch (${activeBatchNames}) of this course. You can only be enrolled in one active batch per course.`, 
        400
      )
    );
  }

  // Check enrollment period if specified
  const now = new Date();
  if (batch.enrollmentStartDate && now < batch.enrollmentStartDate) {
    return next(
      new ErrorResponse(`Enrollment for this batch has not started yet`, 400)
    );
  }
  if (batch.enrollmentEndDate && now > batch.enrollmentEndDate) {
    return next(
      new ErrorResponse(`Enrollment period for this batch has ended`, 400)
    );
  }

  const totalClasses = await liveClassRepository.find({batchId: batch.id});

  // Create enrollment with default payment status
  const enrollmentData = {
    studentId: studentId,
    courseId: courseId,
    batchId: batchId,
    enrolledBy: studentId, // Self-enrolled
    progress: {
      totalClasses: totalClasses.length
    },
    payment: {
      status: course.fee && course.fee > 0 ? 'PENDING' : 'WAIVED',
      amount: course.fee || 0
    }
  };

  const enrollment = await Enrollment.create(enrollmentData);

  // Update batch enrollment count
  batch.currentEnrollment += 1;
  await batch.save();

  // Update course enrollment count
  course.enrollmentCount += 1;
  await course.save();

  // Send enrollment confirmation email
  try {
    const student = await User.findById(studentId);
    await emailService.sendEnrollmentConfirmation({
      studentEmail: student.email,
      studentName: `${student.firstName} ${student.lastName}`,
      courseName: course.title,
      batchName: batch.name,
      batchSchedule: batch.schedule,
      startDate: batch.startDate,
      paymentStatus: enrollment.payment.status,
      amountPaid: enrollment.payment.amount
    });
  } catch (err) {
    console.error('Error sending enrollment email:', err);
  }

  // Populate the enrollment with related data
  await enrollment.populate([
    { path: 'courseId', select: 'title description thumbnail' },
    { path: 'batchId', select: 'name batchCode schedule startDate endDate' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Successfully enrolled in the course',
    data: enrollment
  });
});
