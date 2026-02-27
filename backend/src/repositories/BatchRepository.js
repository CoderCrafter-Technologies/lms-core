const BaseRepository = require('./BaseRepository');
const Batch = require('../models/Batch');

class BatchRepository extends BaseRepository {
  constructor() {
    super(Batch);
  }

  /**
   * Find batches by course
   * @param {String} courseId - Course ID
   * @returns {Promise<Array>} Batches for the course
   */
  async findByCourse(courseId) {
    return await this.find({ courseId }, {
      populate: { path: 'instructorId', select: 'firstName lastName email' },
      sort: { startDate: 1 }
    });
  }

  /**
   * Find batches by instructor
   * @param {String} instructorId - Instructor ID
   * @returns {Promise<Array>} Batches taught by instructor
   */
  async findByInstructor(instructorId) {
    return await this.find({ instructorId }, {
      populate: { path: 'courseId', select: 'title' },
      sort: { startDate: -1 }
    });
  }

  /**
   * Find upcoming batches
   * @returns {Promise<Array>} Upcoming batches
   */
  async findUpcoming() {
    return await this.find({
      status: 'UPCOMING',
      startDate: { $gt: new Date() }
    }, {
      sort: { startDate: 1 }
    });
  }

  /**
   * Find active batches
   * @returns {Promise<Array>} Active batches
   */
  async findActive() {
    return await this.find({ status: 'ACTIVE' }, {
      sort: { startDate: 1 }
    });
  }
}

module.exports = BatchRepository;