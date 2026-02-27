const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const TIMEZONE_ALIASES = {
  IST: 'Asia/Kolkata',
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
  CET: 'Europe/Paris'
};

const toCanonicalTimezone = (value) => {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const aliased = TIMEZONE_ALIASES[raw.toUpperCase()] || raw;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: aliased });
    return aliased;
  } catch {
    return null;
  }
};

const parseDateInput = (input) => {
  const value = String(input || '').trim();
  const directMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (directMatch) {
    return {
      year: Number(directMatch[1]),
      month: Number(directMatch[2]),
      day: Number(directMatch[3])
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const isoDate = date.toISOString().slice(0, 10);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!isoMatch) return null;

  return {
    year: Number(isoMatch[1]),
    month: Number(isoMatch[2]),
    day: Number(isoMatch[3])
  };
};

const addDaysToDateParts = ({ year, month, day }, daysToAdd = 1) => {
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
};

const compareDateParts = (left, right) => {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
};

const getDayNameForDateParts = ({ year, month, day }) => {
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return DAY_NAMES[dayIndex];
};

const getTimezoneOffsetMilliseconds = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return asUTC - date.getTime();
};

const zonedDateTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) => {
  let timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = getTimezoneOffsetMilliseconds(new Date(timestamp), timeZone);
  timestamp -= offset;

  const nextOffset = getTimezoneOffsetMilliseconds(new Date(timestamp), timeZone);
  if (nextOffset !== offset) {
    timestamp -= (nextOffset - offset);
  }

  return new Date(timestamp);
};

const getDatePartsInTimezone = (dateInput, timeZone) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
};

module.exports = {
  DAY_NAMES,
  toCanonicalTimezone,
  parseDateInput,
  addDaysToDateParts,
  compareDateParts,
  getDayNameForDateParts,
  zonedDateTimeToUtc,
  getDatePartsInTimezone
};
