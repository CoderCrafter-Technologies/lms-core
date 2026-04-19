const { asyncHandler } = require('../middleware/errorHandler');
const {
  getStudentAttendanceOverview,
  getInstructorAttendanceOverview,
} = require('../services/attendanceOverviewService');

const getMyStudentAttendanceOverview = asyncHandler(async (req, res) => {
  const data = await getStudentAttendanceOverview({
    studentId: req.userId,
  });

  res.json({
    success: true,
    data,
  });
});

const getMyInstructorAttendanceOverview = asyncHandler(async (req, res) => {
  const data = await getInstructorAttendanceOverview({
    instructorId: req.userId,
  });

  res.json({
    success: true,
    data,
  });
});

module.exports = {
  getMyStudentAttendanceOverview,
  getMyInstructorAttendanceOverview,
};
