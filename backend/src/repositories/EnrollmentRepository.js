const BaseRepository = require('./BaseRepository');
const Enrollment = require('../models/Enrollment');

class EnrollmentRepository extends BaseRepository {
  constructor() {
    super(Enrollment);
  }

  /**
   * Find enrollments by student
   * @param {String} studentId - Student ID
   * @returns {Promise<Array>} Student enrollments
   */
  async findByStudent(studentId) {
    return await this.find({ studentId }, {
      populate: [
        { path: 'courseId', select: 'title category level thumbnail' },
        { path: 'batchId', select: 'name batchCode startDate endDate schedule status' }
      ],
      sort: { enrollmentDate: -1 }
    });
  }



   /**
   * Find enrollments by student and course
   * @param {String} studentId - Student ID
   * @param {String} courseId - Course ID
   * @returns {Promise<Array>} Student enrollments
   */
  async findByStudentAndCourse(studentId, courseId) {
    return await this.find({ studentId, courseId }, {
      populate: [
        { path: 'courseId', select: 'title category level thumbnail' },
        { path: 'batchId', select: 'name batchCode startDate endDate schedule status' }
      ],
      sort: { enrollmentDate: -1 }
    });
  }

  /**
   * Find enrollments by course
   * @param {String} courseId - Course ID
   * @returns {Promise<Array>} Course enrollments
   */
  async findByCourse(courseId) {
    return await this.find({ courseId }, {
      populate: [
        { path: 'studentId', select: 'firstName lastName email phone avatar' },
        { path: 'batchId', select: 'name batchCode startDate endDate' }
      ],
      sort: { enrollmentDate: -1 }
    });
  }

  /**
   * Find enrollments by batch
   * @param {String} batchId - Batch ID
   * @returns {Promise<Array>} Batch enrollments
   */
  async findByBatch(batchId) {
    return await this.find({ batchId }, {
      populate: [
        { path: 'studentId', select: 'firstName lastName email phone avatar isActive' },
        { path: 'courseId', select: 'title category' }
      ],
      sort: { enrollmentDate: -1 }
    });
  }

  /**
   * Find active enrollments
   * @returns {Promise<Array>} Active enrollments
   */
  async findActiveEnrollments() {
    return await this.find({ status: 'ENROLLED' }, {
      populate: [
        { path: 'studentId', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ]
    });
  }

  /**
   * Check if student is already enrolled in a batch
   * @param {String} studentId - Student ID
   * @param {String} batchId - Batch ID
   * @returns {Promise<Boolean>} Is enrolled
   */
  async isStudentEnrolled(studentId, batchId) {
    const enrollment = await this.findOne({ studentId, batchId });
    return !!enrollment;
  }

  /**
   * Get enrollment statistics
   * @returns {Promise<Object>} Enrollment statistics
   */
  async getEnrollmentStats() {
    const stats = await this.model.aggregate([
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          activeEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'ENROLLED'] }, 1, 0] }
          },
          completedEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          droppedEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'DROPPED'] }, 1, 0] }
          },
          averageProgress: { $avg: '$progress.completionPercentage' },
          averageAttendance: { $avg: '$attendance.attendancePercentage' }
        }
      }
    ]);

    return stats[0] || {
      totalEnrollments: 0,
      activeEnrollments: 0,
      completedEnrollments: 0,
      droppedEnrollments: 0,
      averageProgress: 0,
      averageAttendance: 0
    };
  }

  /**
   * Get enrollment statistics by course
   * @param {String} courseId - Course ID
   * @returns {Promise<Object>} Course enrollment statistics
   */
  async getCourseEnrollmentStats(courseId) {
    const stats = await this.model.aggregate([
      { $match: { courseId: courseId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      enrolled: 0,
      completed: 0,
      dropped: 0,
      suspended: 0
    };

    stats.forEach(stat => {
      result.total += stat.count;
      result[stat._id.toLowerCase()] = stat.count;
    });

    return result;
  }

  /**
   * Get enrollment statistics by batch
   * @param {String} batchId - Batch ID
   * @returns {Promise<Object>} Batch enrollment statistics
   */
  async getBatchEnrollmentStats(batchId) {
    const stats = await this.model.aggregate([
      { $match: { batchId: batchId } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averageProgress: { $avg: '$progress.completionPercentage' },
          averageAttendance: { $avg: '$attendance.attendancePercentage' },
          completedStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalStudents: 0,
      averageProgress: 0,
      averageAttendance: 0,
      completedStudents: 0
    };
  }

  /**
   * Get students with low attendance
   * @param {Number} threshold - Attendance threshold (default: 75)
   * @returns {Promise<Array>} Students with low attendance
   */
  async getStudentsWithLowAttendance(threshold = 75) {
    return await this.find({
      status: 'ENROLLED',
      'attendance.attendancePercentage': { $lt: threshold },
      'attendance.totalClasses': { $gt: 0 }
    }, {
      populate: [
        { path: 'studentId', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ]
    });
  }

  /**
   * Get students by progress range
   * @param {Number} minProgress - Minimum progress percentage
   * @param {Number} maxProgress - Maximum progress percentage
   * @returns {Promise<Array>} Students in progress range
   */
  async getStudentsByProgressRange(minProgress, maxProgress) {
    return await this.find({
      status: 'ENROLLED',
      'progress.completionPercentage': { 
        $gte: minProgress, 
        $lte: maxProgress 
      }
    }, {
      populate: [
        { path: 'studentId', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ]
    });
  }

  /**
   * Get enrollment trends over time
   * @param {Number} days - Number of days to look back (default: 30)
   * @returns {Promise<Array>} Enrollment trends
   */
  async getEnrollmentTrends(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.model.aggregate([
      {
        $match: {
          enrollmentDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$enrollmentDate'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
  }
}

module.exports = EnrollmentRepository;