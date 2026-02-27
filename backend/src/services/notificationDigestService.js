const Notification = require('../models/Notification');
const { userRepository } = require('../repositories');
const notificationService = require('./notificationService');
const { normalizeNotificationSettings } = require('../utils/notificationSettings');

const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const getWindowStart = (settings, now) => {
  const hours = settings.digestFrequency === 'WEEKLY' ? 24 * 7 : 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
};

const getMinimumIntervalMs = (settings) =>
  settings.digestFrequency === 'WEEKLY'
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;

const getNextDigestAt = (settings, now = new Date()) => {
  const candidate = new Date(now);
  candidate.setUTCMinutes(0, 0, 0);
  candidate.setUTCHours(settings.digestHourUTC);

  if (candidate <= now) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  if (settings.digestFrequency === 'WEEKLY') {
    const day = candidate.getUTCDay() || 7;
    const daysUntilMonday = (8 - day) % 7;
    if (daysUntilMonday > 0) {
      candidate.setUTCDate(candidate.getUTCDate() + daysUntilMonday);
    }
  }

  return candidate;
};

const isDigestDue = (settings, now) => {
  if (!settings.digestEnabled) return false;
  if (now.getUTCHours() !== settings.digestHourUTC) return false;

  if (!settings.lastDigestSentAt) return true;
  const lastSentAt = new Date(settings.lastDigestSentAt);

  return (now.getTime() - lastSentAt.getTime()) >= getMinimumIntervalMs(settings);
};

const queryDigestItems = async (userId, settings, now = new Date()) => {
  const rangeStart = settings.lastDigestSentAt
    ? new Date(settings.lastDigestSentAt)
    : getWindowStart(settings, now);

  const items = await Notification.find({
    recipientId: userId,
    isArchived: false,
    readAt: null,
    createdAt: { $gte: rangeStart },
    'data.digest': { $ne: true }
  }).select('priority type createdAt title message');

  const filtered = items.filter((item) => {
    const type = item.type;
    const priority = VALID_PRIORITIES.includes(item.priority) ? item.priority : 'normal';
    if (Array.isArray(settings.mutedTypes) && settings.mutedTypes.includes(type)) return false;
    if (Array.isArray(settings.mutedPriorities) && settings.mutedPriorities.includes(priority)) return false;
    return true;
  });

  return {
    rangeStart,
    rangeEnd: now,
    items: filtered
  };
};

const buildDigestSummary = (items = []) => {
  const summaryByPriority = items.reduce((acc, item) => {
    const key = VALID_PRIORITIES.includes(item.priority) ? item.priority : 'normal';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const summaryByType = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return {
    totalUnread: items.length,
    summaryByPriority,
    summaryByType
  };
};

class NotificationDigestService {
  async getDigestStatusForUser(userId, now = new Date()) {
    const user = await userRepository.findById(userId, { select: 'notificationSettings isActive' });
    const settings = normalizeNotificationSettings(user?.notificationSettings || {});

    return {
      digestEnabled: settings.digestEnabled,
      digestFrequency: settings.digestFrequency,
      digestHourUTC: settings.digestHourUTC,
      lastDigestSentAt: settings.lastDigestSentAt || null,
      nextDigestAtUTC: getNextDigestAt(settings, now),
      isDueNow: isDigestDue(settings, now)
    };
  }

  async getDigestPreviewForUser(userId, now = new Date()) {
    const user = await userRepository.findById(userId, { select: 'notificationSettings isActive' });
    const settings = normalizeNotificationSettings(user?.notificationSettings || {});
    const { rangeStart, rangeEnd, items } = await queryDigestItems(userId, settings, now);
    const summary = buildDigestSummary(items);

    return {
      windowStart: rangeStart,
      windowEnd: rangeEnd,
      ...summary
    };
  }

  async sendDigestForUser(userId, { now = new Date(), force = false } = {}) {
    const user = await userRepository.findById(userId, { select: '_id notificationSettings isActive' });
    if (!user || !user.isActive) {
      return { sent: false, reason: 'USER_INACTIVE_OR_MISSING', totalUnread: 0 };
    }

    const settings = normalizeNotificationSettings(user.notificationSettings || {});
    if (!force && !isDigestDue(settings, now)) {
      return { sent: false, reason: 'NOT_DUE', totalUnread: 0 };
    }

    const { rangeStart, rangeEnd, items } = await queryDigestItems(user._id, settings, now);
    const summary = buildDigestSummary(items);

    if (summary.totalUnread > 0) {
      const label = settings.digestFrequency === 'WEEKLY' ? 'weekly' : 'daily';
      await notificationService.createForUser({
        recipientId: user._id.toString(),
        actorId: null,
        type: 'SYSTEM',
        title: `Your ${label} notification digest`,
        message: `You have ${summary.totalUnread} unread notifications waiting for review.`,
        priority: 'normal',
        data: {
          digest: true,
          bypassPreferenceFilters: true,
          digestFrequency: settings.digestFrequency,
          rangeStart,
          rangeEnd,
          totalUnread: summary.totalUnread,
          summaryByPriority: summary.summaryByPriority,
          summaryByType: summary.summaryByType
        }
      });
    }

    await userRepository.updateById(user._id, {
      'notificationSettings.lastDigestSentAt': now
    });

    return {
      sent: summary.totalUnread > 0,
      reason: summary.totalUnread > 0 ? 'SENT' : 'NO_ITEMS',
      totalUnread: summary.totalUnread,
      summaryByPriority: summary.summaryByPriority,
      summaryByType: summary.summaryByType,
      windowStart: rangeStart,
      windowEnd: rangeEnd
    };
  }

  async runDigestSweep(now = new Date()) {
    const users = await userRepository.find(
      { isActive: true, 'notificationSettings.digestEnabled': true },
      { select: '_id notificationSettings' }
    );

    let sentCount = 0;
    let dueCount = 0;

    for (const user of users) {
      const settings = normalizeNotificationSettings(user.notificationSettings || {});
      if (!isDigestDue(settings, now)) continue;
      dueCount += 1;

      const result = await this.sendDigestForUser(user._id.toString(), { now, force: true });
      if (result.sent) {
        sentCount += 1;
      }
    }

    return { sentCount, dueCount, scannedUsers: users.length };
  }
}

module.exports = new NotificationDigestService();
