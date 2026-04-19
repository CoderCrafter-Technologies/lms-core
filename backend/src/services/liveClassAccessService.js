const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveLiveClassAccess = (liveClass, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();

  const scheduledStartTime = toDate(liveClass?.scheduledStartTime);
  const scheduledEndTime = toDate(liveClass?.scheduledEndTime);
  const actualStartTime = toDate(liveClass?.actualStartTime);
  const actualEndTime = toDate(liveClass?.actualEndTime);
  const status = String(liveClass?.status || '').toUpperCase();

  const resolvedStartTime = actualStartTime || scheduledStartTime;
  const resolvedEndTime = actualEndTime || scheduledEndTime;

  let state = 'upcoming';
  let reason = 'scheduled';
  let canJoin = false;
  let message = 'This class has not started yet.';

  if (status === 'CANCELLED') {
    state = 'cancelled';
    reason = 'cancelled';
    message = 'This class has been cancelled.';
  } else if (
    status === 'ENDED' ||
    actualEndTime ||
    (resolvedEndTime && now.getTime() >= resolvedEndTime.getTime())
  ) {
    state = 'ended';
    reason = 'ended';
    message = 'This class has already ended.';
  } else if (scheduledStartTime && now.getTime() < scheduledStartTime.getTime()) {
    state = 'upcoming';
    reason = 'not_started';
    message = 'This class has not started yet.';
  } else if (
    status === 'LIVE' ||
    actualStartTime ||
    (scheduledStartTime &&
      resolvedEndTime &&
      now.getTime() >= scheduledStartTime.getTime() &&
      now.getTime() < resolvedEndTime.getTime())
  ) {
    state = 'live';
    reason = 'live';
    canJoin = true;
    message = 'Class is live now.';
  }

  return {
    canJoin,
    state,
    reason,
    message,
    startsAt: resolvedStartTime ? resolvedStartTime.toISOString() : null,
    endsAt: resolvedEndTime ? resolvedEndTime.toISOString() : null,
    checkedAt: now.toISOString(),
  };
};

const withLiveClassAccess = (liveClass, options = {}) => {
  if (!liveClass) return liveClass;

  const serialized =
    typeof liveClass.toObject === 'function' ? liveClass.toObject() : { ...liveClass };
  const access = resolveLiveClassAccess(serialized, options);

  return {
    ...serialized,
    access,
    canJoin: access.canJoin,
    accessState: access.state,
    accessMessage: access.message,
  };
};

const withLiveClassAccessList = (liveClasses = [], options = {}) =>
  liveClasses.map((liveClass) => withLiveClassAccess(liveClass, options));

module.exports = {
  resolveLiveClassAccess,
  withLiveClassAccess,
  withLiveClassAccessList,
};
