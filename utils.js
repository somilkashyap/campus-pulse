/**
 * Campus Pulse - Pure Utility Functions
 * Works in both Browser (window.CampusUtils) and Node.js (module.exports).
 * Zero external dependencies.
 */

const ALLOWED_CATEGORIES = [
  'Academic',
  'Event',
  'Deadline',
  'Club',
  'Placement',
  'Sports',
  'Other'
];

/**
 * Returns today's ISO date string (YYYY-MM-DD).
 */
function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns an ISO date string (YYYY-MM-DD) shifted by a relative number of days.
 */
function getOffsetDateISO(offsetDays, baseToday) {
  const ref = baseToday ? parseISODate(baseToday) : new Date();
  if (!ref) return getTodayISO();
  ref.setDate(ref.getDate() + offsetDays);
  const year = ref.getFullYear();
  const month = String(ref.getMonth() + 1).padStart(2, '0');
  const day = String(ref.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parses YYYY-MM-DD into a local midnight Date.
 */
function parseISODate(isoString) {
  if (!isoString || typeof isoString !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  const dt = new Date(year, month, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) {
    return null;
  }
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * Computes priority status from today's date for any notice:
 * - 'Expired': date < today
 * - 'Today': date === today
 * - 'Urgent': date > today && date <= 48 hours from today (1 or 2 days away)
 * - 'Upcoming': date > 48 hours from today
 */
function getStatus(date, today) {
  if (!date || typeof date !== 'string') {
    return 'Upcoming';
  }

  const cleanDate = date.trim();
  const refToday = (today && typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today.trim()))
    ? today.trim()
    : getTodayISO();

  if (cleanDate === refToday) {
    return 'Today';
  }
  if (cleanDate < refToday) {
    return 'Expired';
  }

  const targetDt = parseISODate(cleanDate);
  const todayDt = parseISODate(refToday);

  if (!targetDt || !todayDt) {
    return 'Upcoming';
  }

  const diffMs = targetDt.getTime() - todayDt.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 1 && diffDays <= 2) {
    return 'Urgent'; // Within 48 hours
  }
  return 'Upcoming';
}

/**
 * Sorts notices array by urgency:
 * Priority Rank:
 * 1. Today
 * 2. Urgent (within 48h)
 * 3. Upcoming
 * 4. Expired
 *
 * Secondary sort:
 * - Active notices (Today, Urgent, Upcoming): sorted chronologically by date, then time.
 * - Expired notices: sorted reverse-chronologically (most recently expired first).
 */
function sortByUrgency(notices, today) {
  if (!Array.isArray(notices)) return [];

  const refToday = today || getTodayISO();
  const statusRank = {
    'Today': 1,
    'Urgent': 2,
    'Upcoming': 3,
    'Expired': 4
  };

  return [...notices].sort((a, b) => {
    const statusA = getStatus(a.date, refToday);
    const statusB = getStatus(b.date, refToday);

    const rankA = statusRank[statusA] || 5;
    const rankB = statusRank[statusB] || 5;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Both are expired: most recently expired first (descending date)
    if (statusA === 'Expired') {
      return (b.date || '').localeCompare(a.date || '');
    }

    // Both are active: earliest date first (ascending date)
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;

    // Tie-break by time
    return (a.time || '').localeCompare(b.time || '');
  });
}

/**
 * Filters notices by search query and category.
 * - category: 'All' or specific category name (case-insensitive)
 * - query: search string matching title, venue, or description (case-insensitive)
 */
function filterNotices(notices, query, category) {
  if (!Array.isArray(notices)) return [];

  const catFilter = (category || 'all').trim().toLowerCase();
  const q = (query || '').trim().toLowerCase();

  return notices.filter(notice => {
    if (!notice || typeof notice !== 'object') return false;

    // Check category
    if (catFilter !== 'all') {
      const noticeCat = (notice.category || '').trim().toLowerCase();
      if (noticeCat !== catFilter) return false;
    }

    // Check query
    if (!q) return true;

    const title = (notice.title || '').toLowerCase();
    const venue = (notice.venue || '').toLowerCase();
    const desc = (notice.description || '').toLowerCase();

    return title.includes(q) || venue.includes(q) || desc.includes(q);
  });
}

/**
 * Validates a notice object:
 * - Title: required, non-empty, not 'Not specified'
 * - ISO date: valid YYYY-MM-DD real calendar date
 * - Category: must be one of ALLOWED_CATEGORIES
 *
 * Returns { valid: boolean, errors: string[] }
 */
function validateNotice(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Notice must be a valid object');
    return {
      valid: false,
      errors,
      valueOf() { return false; },
      [Symbol.toPrimitive]() { return false; }
    };
  }

  // 1. Title validation
  if (!obj.title || typeof obj.title !== 'string') {
    errors.push('Title is required and must be a string');
  } else {
    const trimmedTitle = obj.title.trim();
    if (trimmedTitle.length === 0) {
      errors.push('Title cannot be empty');
    } else if (trimmedTitle.toLowerCase() === 'not specified') {
      errors.push('Title cannot be "Not specified"');
    }
  }

  // 2. ISO Date validation
  if (!obj.date || typeof obj.date !== 'string') {
    errors.push('Date is required in ISO YYYY-MM-DD format');
  } else {
    const trimmedDate = obj.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      errors.push('Date must match format YYYY-MM-DD');
    } else {
      const parsed = parseISODate(trimmedDate);
      if (!parsed) {
        errors.push('Date must be a real calendar date');
      }
    }
  }

  // 3. Category validation
  if (!obj.category || typeof obj.category !== 'string') {
    errors.push(`Category is required and must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  } else {
    const trimmedCat = obj.category.trim();
    const isValidCategory = ALLOWED_CATEGORIES.some(
      c => c.toLowerCase() === trimmedCat.toLowerCase()
    );
    if (!isValidCategory) {
      errors.push(`Invalid category "${trimmedCat}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}`);
    }
  }

  const isValid = errors.length === 0;
  return {
    valid: isValid,
    errors,
    valueOf() { return isValid; },
    [Symbol.toPrimitive]() { return isValid; }
  };
}

/**
 * Strips markdown code fences (```json or ```) and safely parses JSON text.
 * Returns the parsed JSON value or null on error.
 */
function parseGeminiJson(text) {
  if (!text || typeof text !== 'string') return null;

  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.slice(7);
  } else if (clean.startsWith('```')) {
    clean = clean.slice(3);
  }

  if (clean.endsWith('```')) {
    clean = clean.slice(0, -3);
  }

  clean = clean.trim();
  if (!clean) return null;

  try {
    return JSON.parse(clean);
  } catch (err) {
    return null;
  }
}

/**
 * Checks if a given notice date falls within "this week" relative to today.
 * Specifically: date is today or up to 7 days in the future (today <= date <= today + 7).
 */
function isThisWeek(date, today) {
  if (!date || typeof date !== 'string') return false;

  const cleanDate = date.trim();
  const refToday = (today && typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today.trim()))
    ? today.trim()
    : getTodayISO();

  const targetDt = parseISODate(cleanDate);
  const todayDt = parseISODate(refToday);

  if (!targetDt || !todayDt) return false;

  const diffMs = targetDt.getTime() - todayDt.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Within next 7 days inclusive from today
  return diffDays >= 0 && diffDays <= 7;
}

/**
 * Formats an ISO date into a student-friendly relative or calendar string.
 */
function formatReadableDate(isoDateString, refToday) {
  if (!isoDateString || typeof isoDateString !== 'string') return '';
  const parsed = parseISODate(isoDateString);
  if (!parsed) return isoDateString;

  const todayStr = refToday || getTodayISO();
  const todayDt = parseISODate(todayStr) || new Date();
  todayDt.setHours(0, 0, 0, 0);

  const diffTime = parsed.getTime() - todayDt.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = monthNames[parsed.getMonth()];
  const day = parsed.getDate();
  const year = parsed.getFullYear();

  if (diffDays === 0) {
    return `Today (${monthStr} ${day})`;
  } else if (diffDays === 1) {
    return `Tomorrow (${monthStr} ${day})`;
  } else if (diffDays === -1) {
    return `Yesterday (${monthStr} ${day})`;
  } else if (diffDays > 1 && diffDays <= 7) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `In ${diffDays} days (${daysOfWeek[parsed.getDay()]}, ${monthStr} ${day})`;
  } else if (diffDays < -1) {
    return `${monthStr} ${day}, ${year} (Past)`;
  }
  return `${monthStr} ${day}, ${year}`;
}

/**
 * Auto-removes expired notices older than 30 days and caps total items at maxItems.
 */
function cleanAndCapNotices(noticesArray, maxItems = 200, maxDaysExpired = 30) {
  if (!Array.isArray(noticesArray)) return [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now.getTime() - (maxDaysExpired * 24 * 60 * 60 * 1000));
  const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  let cleaned = noticesArray.filter(notice => {
    if (!notice || typeof notice !== 'object') return false;
    if (!notice.date || !/^\d{4}-\d{2}-\d{2}$/.test(notice.date)) return true;
    return notice.date >= cutoffISO;
  });

  if (cleaned.length > maxItems) {
    cleaned = cleaned.slice(0, maxItems);
  }

  return cleaned;
}

// Module / Browser Export
const CampusUtils = {
  ALLOWED_CATEGORIES,
  getTodayISO,
  getOffsetDateISO,
  parseISODate,
  getStatus,
  sortByUrgency,
  filterNotices,
  validateNotice,
  parseGeminiJson,
  isThisWeek,
  formatReadableDate,
  cleanAndCapNotices
};

if (typeof window !== 'undefined') {
  window.CampusUtils = CampusUtils;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CampusUtils;
}

