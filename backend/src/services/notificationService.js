const NotificationRepository = require('../repositories/NotificationRepository');
const { getSocketHandler } = require('./socketBridge');
const { userRepository } = require('../repositories');
const { shouldDeliverNotification } = require('../utils/notificationSettings');

class NotificationService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  async createForUser(payload) {
    if (payload?.recipientId) {
      const recipient = await userRepository.findById(payload.recipientId, { select: 'notificationSettings isActive' });
      if (!recipient || !recipient.isActive || !shouldDeliverNotification(recipient.notificationSettings, payload)) {
        return null;
      }
    }

    const notification = await this.notificationRepository.create(payload);
    this.emitRealtime(payload.recipientId, notification);
    return notification;
  }

  async createForUsers(recipientIds = [], payload = {}) {
    const uniqueRecipientIds = [...new Set((recipientIds || []).filter(Boolean).map((id) => id.toString()))];
    if (uniqueRecipientIds.length === 0) return [];
    const recipients = await userRepository.find(
      { _id: { $in: uniqueRecipientIds }, isActive: true },
      { select: '_id notificationSettings isActive' }
    );

    const allowedRecipientIds = recipients
      .filter((user) => shouldDeliverNotification(user.notificationSettings, payload))
      .map((user) => user.id || user._id?.toString())
      .filter(Boolean);

    if (allowedRecipientIds.length === 0) return [];

    const docs = await Promise.all(allowedRecipientIds.map((recipientId) =>
      this.notificationRepository.create({
        recipientId,
        ...payload
      })
    ));

    docs.forEach((doc, index) => {
      this.emitRealtime(allowedRecipientIds[index], doc);
    });

    return docs;
  }

  async notifyRoles(userRepository, roleNames = [], payload = {}) {
    const users = await userRepository.find({}, {
      populate: { path: 'roleId', select: 'name' },
      select: 'isActive roleId'
    });

    const recipients = users
      .filter((user) => user.isActive && roleNames.includes(user.roleId?.name))
      .map((user) => user.id || user._id?.toString())
      .filter(Boolean);

    return this.createForUsers(recipients, payload);
  }

  emitRealtime(userId, notification) {
    const socketHandler = getSocketHandler();
    if (!socketHandler || !userId) return;

    try {
      socketHandler.emitToUser(userId.toString(), 'notification:new', notification);
    } catch (error) {
      // Keep notification persistence resilient even if socket delivery fails
      console.error('Failed to emit realtime notification:', error?.message || error);
    }
  }
}

module.exports = new NotificationService();
