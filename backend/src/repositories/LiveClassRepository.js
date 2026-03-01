const BaseRepository = require('./BaseRepository');
const LiveClass = require('../models/LiveClass');

class LiveClassRepository extends BaseRepository {
  constructor() {
    super(LiveClass);
  }

  /**
   * Find live classes by batch
   * @param {String} batchId - Batch ID
   * @returns {Promise<Array>} Live classes for the batch
   */
  async findByBatch(batchId) {
    return await this.find({ batchId }, {
      sort: { scheduledStartTime: 1 },
      populate: {
        path: 'instructorId',
        select: 'firstName lastName email'
      }
    });
  }

  /**
   * Find live classes by instructor
   * @param {String} instructorId - Instructor ID
   * @returns {Promise<Array>} Live classes by instructor
   */
  async findByInstructor(instructorId) {
    return await this.find({ instructorId }, {
      sort: { scheduledStartTime: -1 }
    });
  }

  /**
   * Find upcoming live classes
   * @returns {Promise<Array>} Upcoming live classes
   */
  async findUpcoming() {
    const now = new Date();
    return await this.find({
      status: 'SCHEDULED',
      scheduledStartTime: { $gt: now }
    }, {
      sort: { scheduledStartTime: 1 }
    });
  }

  /**
   * Find currently live classes
   * @returns {Promise<Array>} Currently live classes
   */
  async findLive() {
    return await this.find({ status: 'LIVE' });
  }

  /**
   * Find classes by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Classes in date range
   */
  async findByDateRange(startDate, endDate) {
    return await this.find({
      scheduledStartTime: {
        $gte: startDate,
        $lte: endDate
      }
    }, {
      sort: { scheduledStartTime: 1 }
    });
  }

  /**
   * Ensure a stable roomId exists for a live class record.
   * If missing, generate a deterministic roomId and persist it.
   * @param {Object} liveClass
   * @returns {Promise<Object|null>}
   */
  async ensureRoomId(liveClass) {
    if (!liveClass) return liveClass;
    if (liveClass.roomId) return liveClass;

    const classId = liveClass.id || liveClass._id;
    if (!classId) return liveClass;

    const roomId = `room_${classId}`;
    try {
      await this.updateById(classId, { roomId });
    } catch (error) {
      // Best-effort: don't break reads if update fails
    }

    return { ...liveClass, roomId };
  }

  /**
   * Ensure roomId for a list of live classes.
   * @param {Array} liveClasses
   * @returns {Promise<Array>}
   */
  async ensureRoomIds(liveClasses = []) {
    return Promise.all(liveClasses.map((item) => this.ensureRoomId(item)));
  }
}

module.exports = LiveClassRepository;
