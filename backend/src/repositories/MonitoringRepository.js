const BaseRepository = require('./BaseRepository');
const MonitoringRecord = require('../models/MonitoringRecord');

class MonitoringRepository extends BaseRepository {
  constructor() {
    super(MonitoringRecord);
  }

  async findRecords(filters = {}, options = {}) {
    const criteria = {};
    if (!filters.includeArchived) {
      criteria.isArchived = { $ne: true };
    }

    if (filters.category) criteria.category = filters.category;
    if (filters.level) criteria.level = filters.level;
    if (filters.source) criteria.source = filters.source;
    if (filters.search) {
      criteria.$or = [
        { message: { $regex: filters.search, $options: 'i' } },
        { action: { $regex: filters.search, $options: 'i' } },
        { entityType: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.from || filters.to) {
      criteria.createdAt = {};
      if (filters.from) criteria.createdAt.$gte = new Date(filters.from);
      if (filters.to) criteria.createdAt.$lte = new Date(filters.to);
    }

    return this.paginate(criteria, {
      page: options.page || 1,
      limit: options.limit || 50,
      sort: { createdAt: -1 },
      populate: { path: 'actorId', select: 'firstName lastName email roleId' }
    });
  }

  async archiveOlderThan(cutoffDate) {
    if (!cutoffDate) return { modifiedCount: 0 };
    const result = await this.model.updateMany(
      { createdAt: { $lt: cutoffDate }, isArchived: { $ne: true } },
      { $set: { isArchived: true } }
    );
    return { modifiedCount: result.modifiedCount || 0 };
  }
}

module.exports = MonitoringRepository;
