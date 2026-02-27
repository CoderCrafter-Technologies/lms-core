const Course = require('../models/Course');
const Batch = require('../models/Batch');
const LiveClass = require('../models/LiveClass');
const Ticket = require('../models/Ticket');
const { asyncHandler } = require('../middleware/errorHandler');
const { userRepository, roleRepository } = require('../repositories');

const getManagerDashboard = asyncHandler(async (req, res) => {
  const [studentRole, instructorRole] = await Promise.all([
    roleRepository.findOne({ name: 'STUDENT' }),
    roleRepository.findOne({ name: 'INSTRUCTOR' })
  ]);

  const [
    totalCourses,
    publishedCourses,
    totalBatches,
    activeBatches,
    totalStudents,
    totalInstructors,
    liveClasses,
    pendingLeaveRequests,
    supportSummary,
    recentCourses,
    recentLiveClasses,
    recentTickets
  ] = await Promise.all([
    Course.countDocuments({}),
    Course.countDocuments({ status: 'PUBLISHED' }),
    Batch.countDocuments({}),
    Batch.countDocuments({ status: 'ACTIVE' }),
    studentRole ? userRepository.count({ roleId: studentRole._id, isActive: true }) : 0,
    instructorRole ? userRepository.count({ roleId: instructorRole._id, isActive: true }) : 0,
    LiveClass.countDocuments({ status: 'LIVE' }),
    Ticket.countDocuments({ type: 'leave', status: 'pending' }),
    Ticket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Course.find({})
      .select('title status createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    LiveClass.find({ status: { $in: ['SCHEDULED', 'LIVE'] } })
      .select('title status scheduledStartTime')
      .sort({ scheduledStartTime: 1 })
      .limit(5)
      .lean(),
    Ticket.find({ status: { $in: ['pending', 'in-progress'] } })
      .select('title type priority status createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
  ]);

  const supportByStatus = supportSummary.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      stats: {
        totalCourses,
        publishedCourses,
        totalBatches,
        activeBatches,
        totalStudents,
        totalInstructors,
        liveClasses,
        pendingLeaveRequests,
        pendingSupportTickets: supportByStatus.pending || 0,
        inProgressSupportTickets: supportByStatus['in-progress'] || 0
      },
      recent: {
        courses: recentCourses,
        liveClasses: recentLiveClasses,
        tickets: recentTickets
      }
    }
  });
});

module.exports = {
  getManagerDashboard
};
