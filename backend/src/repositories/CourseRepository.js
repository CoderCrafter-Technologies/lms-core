const BaseRepository = require('./BaseRepository');
const Course = require('../models/Course');

class CourseRepository extends BaseRepository {
  constructor() {
    super(Course);
  }

  /**
   * Find published courses
   * @returns {Promise<Array>} Published courses
   */
  async findPublished() {
    return await this.find({ status: 'PUBLISHED', isPublic: true }, {
      sort: { publishedAt: -1 }
    });
  }

  /**
   * Find courses by category
   * @param {String} category - Course category
   * @returns {Promise<Array>} Courses in category
   */
  async findByCategory(category) {
    return await this.find({ 
      category, 
      status: 'PUBLISHED', 
      isPublic: true 
    }, {
      sort: { publishedAt: -1 }
    });
  }

  /**
   * Search courses
   * @param {String} query - Search query
   * @returns {Promise<Array>} Matching courses
   */
  async search(query) {
    return await this.find({
      $text: { $search: query },
      status: 'PUBLISHED',
      isPublic: true
    }, {
      sort: { score: { $meta: 'textScore' } }
    });
  }
}

module.exports = CourseRepository;