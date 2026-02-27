const DEFAULT_NOTIFICATION_SETTINGS = {
  inAppEnabled: true,
  browserPushEnabled: true,
  digestEnabled: false,
  digestFrequency: 'DAILY',
  digestHourUTC: 18,
  mutedTypes: [],
  mutedPriorities: [],
  quietHours: {
    enabled: false,
    startHourUTC: 22,
    endHourUTC: 7
  },
  lastDigestSentAt: null
};

const clampHour = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(23, Math.floor(parsed)));
};

const normalizeNotificationSettings = (incoming = {}, current = {}) => {
  const merged = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(current || {}),
    ...(incoming || {})
  };

  const quietHours = {
    ...DEFAULT_NOTIFICATION_SETTINGS.quietHours,
    ...(current?.quietHours || {}),
    ...(incoming?.quietHours || {})
  };

  return {
    inAppEnabled: merged.inAppEnabled !== false,
    browserPushEnabled: merged.browserPushEnabled !== false,
    digestEnabled: merged.digestEnabled === true,
    digestFrequency: ['DAILY', 'WEEKLY'].includes(merged.digestFrequency) ? merged.digestFrequency : 'DAILY',
    digestHourUTC: clampHour(merged.digestHourUTC, DEFAULT_NOTIFICATION_SETTINGS.digestHourUTC),
    mutedTypes: Array.isArray(merged.mutedTypes) ? [...new Set(merged.mutedTypes.filter(Boolean))] : [],
    mutedPriorities: Array.isArray(merged.mutedPriorities)
      ? [...new Set(merged.mutedPriorities.filter((value) => ['low', 'normal', 'high', 'urgent'].includes(value)))]
      : [],
    quietHours: {
      enabled: quietHours.enabled === true,
      startHourUTC: clampHour(quietHours.startHourUTC, DEFAULT_NOTIFICATION_SETTINGS.quietHours.startHourUTC),
      endHourUTC: clampHour(quietHours.endHourUTC, DEFAULT_NOTIFICATION_SETTINGS.quietHours.endHourUTC)
    },
    lastDigestSentAt: merged.lastDigestSentAt || null
  };
};

const isWithinQuietHours = (settings, date = new Date()) => {
  if (!settings?.quietHours?.enabled) return false;

  const currentHour = date.getUTCHours();
  const { startHourUTC, endHourUTC } = settings.quietHours;

  if (startHourUTC === endHourUTC) return true;
  if (startHourUTC < endHourUTC) {
    return currentHour >= startHourUTC && currentHour < endHourUTC;
  }

  return currentHour >= startHourUTC || currentHour < endHourUTC;
};

const shouldDeliverNotification = (settingsInput, payload, date = new Date()) => {
  const settings = normalizeNotificationSettings(settingsInput);
  if (!settings.inAppEnabled) return false;
  if (payload?.data?.bypassPreferenceFilters === true) return true;

  const type = payload?.type;
  const priority = payload?.priority || 'normal';

  if (type && settings.mutedTypes.includes(type)) return false;
  if (settings.mutedPriorities.includes(priority)) return false;

  if (isWithinQuietHours(settings, date) && priority !== 'urgent') {
    return false;
  }

  return true;
};

module.exports = {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
  isWithinQuietHours,
  shouldDeliverNotification
};
