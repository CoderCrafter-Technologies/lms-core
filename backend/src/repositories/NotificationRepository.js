const BaseRepository = require('./BaseRepository');
const Notification = require('../models/Notification');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async findForUser(recipientId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const filters = {
      recipientId,
      isArchived: false,
      ...(unreadOnly ? { readAt: null } : {})
    };

    return this.paginate(filters, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [{ path: 'actorId', select: 'firstName lastName email roleId' }]
    });
  }

  async markAsRead(notificationId, userId) {
    return this.model.findOneAndUpdate(
      { _id: notificationId, recipientId: userId, isArchived: false },
      { $set: { readAt: new Date() } },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    const result = await this.model.updateMany(
      { recipientId: userId, isArchived: false, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    };
  }

  async getUnreadCount(userId) {
    return this.count({ recipientId: userId, isArchived: false, readAt: null });
  }

  async archive(notificationId, userId) {
    return this.model.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { isArchived: true } },
      { new: true }
    );
  }
}

module.exports = NotificationRepository;
