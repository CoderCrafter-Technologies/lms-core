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
}

module.exports = LiveClassRepository;