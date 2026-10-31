/**
 * Automated tests for utils.js using Node.js built-in test runner (node:test and node:assert).
 * Zero external dependencies.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  getStatus,
  sortByUrgency,
  filterNotices,
  validateNotice,
  parseGeminiJson,
  isThisWeek,
  getTodayISO,
  getOffsetDateISO,
  formatReadableDate,
  cleanAndCapNotices
} = require('../utils.js');

const TODAY = '2026-10-31';

test('1. getStatus: returns "Today" when date matches today exactly', () => {
  assert.strictEqual(getStatus('2026-10-31', TODAY), 'Today');
});

test('2. getStatus: returns "Urgent" when date is tomorrow (+1 day, within 48h boundary)', () => {
  assert.strictEqual(getStatus('2026-11-01', TODAY), 'Urgent');
});

test('3. getStatus: returns "Urgent" when date is in 2 days (+2 days, 48h boundary)', () => {
  assert.strictEqual(getStatus('2026-11-02', TODAY), 'Urgent');
});

test('4. getStatus: returns "Upcoming" when date is 3 days away (> 48h boundary)', () => {
  assert.strictEqual(getStatus('2026-11-03', TODAY), 'Upcoming');
});

test('5. getStatus: returns "Upcoming" for far-future dates (+30 days)', () => {
  assert.strictEqual(getStatus('2026-11-30', TODAY), 'Upcoming');
});

test('6. getStatus: returns "Expired" when date is yesterday (-1 day)', () => {
  assert.strictEqual(getStatus('2026-10-30', TODAY), 'Expired');
});

test('7. getStatus: returns "Expired" for dates further in the past (-30 days)', () => {
  assert.strictEqual(getStatus('2026-10-01', TODAY), 'Expired');
});

test('8. getStatus: handles empty string safely', () => {
  assert.strictEqual(getStatus('', TODAY), 'Upcoming');
});

test('9. getStatus: handles invalid date string safely', () => {
  assert.strictEqual(getStatus('not-a-date', TODAY), 'Upcoming');
});

test('10. getStatus: handles null or undefined date safely', () => {
  assert.strictEqual(getStatus(null, TODAY), 'Upcoming');
  assert.strictEqual(getStatus(undefined, TODAY), 'Upcoming');
});

test('11. sortByUrgency: sorts mixed notices into Today -> Urgent -> Upcoming -> Expired', () => {
  const notices = [
    { id: '1', title: 'Future Event', date: '2026-11-10' },
    { id: '2', title: 'Past Notice', date: '2026-10-20' },
    { id: '3', title: 'Due Today', date: '2026-10-31' },
    { id: '4', title: 'Tomorrow Urgent', date: '2026-11-01' }
  ];

  const sorted = sortByUrgency(notices, TODAY);
  const titles = sorted.map(n => n.title);
  assert.deepStrictEqual(titles, ['Due Today', 'Tomorrow Urgent', 'Future Event', 'Past Notice']);
});

test('12. sortByUrgency: sorts active notices chronologically when statuses are equal', () => {
  const notices = [
    { id: '1', title: 'Later Upcoming', date: '2026-11-15' },
    { id: '2', title: 'Earlier Upcoming', date: '2026-11-05' }
  ];

  const sorted = sortByUrgency(notices, TODAY);
  assert.strictEqual(sorted[0].title, 'Earlier Upcoming');
  assert.strictEqual(sorted[1].title, 'Later Upcoming');
});

test('13. sortByUrgency: sorts expired notices reverse-chronologically (most recent first)', () => {
  const notices = [
    { id: '1', title: 'Older Past', date: '2026-10-10' },
    { id: '2', title: 'Recent Past', date: '2026-10-29' }
  ];

  const sorted = sortByUrgency(notices, TODAY);
  assert.strictEqual(sorted[0].title, 'Recent Past');
  assert.strictEqual(sorted[1].title, 'Older Past');
});

test('14. sortByUrgency: handles empty array safely', () => {
  assert.deepStrictEqual(sortByUrgency([], TODAY), []);
});

test('15. filterNotices: filters strictly by specific category', () => {
  const notices = [
    { id: '1', title: 'Exam', category: 'Academic' },
    { id: '2', title: 'Concert', category: 'Event' },
    { id: '3', title: 'Interview', category: 'Placement' }
  ];

  const filtered = filterNotices(notices, '', 'Academic');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].title, 'Exam');
});

test('16. filterNotices: category "All" (case-insensitive) matches all notices', () => {
  const notices = [
    { id: '1', title: 'A', category: 'Academic' },
    { id: '2', title: 'B', category: 'Club' }
  ];

  const filtered = filterNotices(notices, '', 'all');
  assert.strictEqual(filtered.length, 2);
});

test('17. filterNotices: search query filters across title, venue, and description', () => {
  const notices = [
    { id: '1', title: 'Physics Lab', venue: 'Room 101', description: 'Bring manual' },
    { id: '2', title: 'Seminar', venue: 'Auditorium Hall', description: 'Tech talk' },
    { id: '3', title: 'Football', venue: 'Ground', description: 'Wear sports shoes' }
  ];

  // Match title
  assert.strictEqual(filterNotices(notices, 'physics', 'all').length, 1);
  // Match venue
  assert.strictEqual(filterNotices(notices, 'auditorium', 'all').length, 1);
  // Match description
  assert.strictEqual(filterNotices(notices, 'sports shoes', 'all').length, 1);
});

test('18. filterNotices: returns empty array when query does not match anything', () => {
  const notices = [{ id: '1', title: 'Hackathon', venue: 'Lab', description: 'Coding' }];
  const filtered = filterNotices(notices, 'nonexistent', 'all');
  assert.strictEqual(filtered.length, 0);
});

test('19. filterNotices: handles empty list or non-array inputs gracefully', () => {
  assert.deepStrictEqual(filterNotices([], 'test', 'all'), []);
  assert.deepStrictEqual(filterNotices(null, 'test', 'all'), []);
});

test('20. validateNotice: validates correct notice object', () => {
  const notice = {
    title: 'Mid-term Exam',
    date: '2026-11-05',
    category: 'Academic'
  };
  const res = validateNotice(notice);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
});

test('21. validateNotice: fails when title is missing or empty', () => {
  const noticeNoTitle = { date: '2026-11-05', category: 'Academic' };
  const res1 = validateNotice(noticeNoTitle);
  assert.strictEqual(res1.valid, false);

  const noticeEmptyTitle = { title: '   ', date: '2026-11-05', category: 'Academic' };
  const res2 = validateNotice(noticeEmptyTitle);
  assert.strictEqual(res2.valid, false);
});

test('22. validateNotice: fails when title is placeholder "Not specified"', () => {
  const notice = { title: 'Not specified', date: '2026-11-05', category: 'Academic' };
  const res = validateNotice(notice);
  assert.strictEqual(res.valid, false);
});

test('23. validateNotice: fails when category is invalid or disallowed', () => {
  const notice = { title: 'Study group', date: '2026-11-05', category: 'UnknownCategory' };
  const res = validateNotice(notice);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('Invalid category')));
});

test('24. validateNotice: fails when date is not in ISO YYYY-MM-DD format', () => {
  const notice = { title: 'Study group', date: '11/05/2026', category: 'Academic' };
  const res = validateNotice(notice);
  assert.strictEqual(res.valid, false);
});

test('25. validateNotice: fails when date is impossible calendar date (e.g. Feb 31)', () => {
  const notice = { title: 'Study group', date: '2026-02-31', category: 'Academic' };
  const res = validateNotice(notice);
  assert.strictEqual(res.valid, false);
});

test('26. validateNotice: fails when input is not an object (null, string, number)', () => {
  assert.strictEqual(validateNotice(null).valid, false);
  assert.strictEqual(validateNotice('string').valid, false);
});

test('27. parseGeminiJson: successfully parses valid raw JSON string', () => {
  const raw = '[{"title":"Test Notice","date":"2026-11-01"}]';
  const parsed = parseGeminiJson(raw);
  assert.ok(Array.isArray(parsed));
  assert.strictEqual(parsed[0].title, 'Test Notice');
});

test('28. parseGeminiJson: strips ```json code fences properly', () => {
  const fenced = '```json\n[{"title":"Fenced Notice"}]\n```';
  const parsed = parseGeminiJson(fenced);
  assert.ok(Array.isArray(parsed));
  assert.strictEqual(parsed[0].title, 'Fenced Notice');
});

test('29. parseGeminiJson: strips generic ``` code fences properly', () => {
  const fenced = '```\n{"summary":"Weekly recap"}\n```';
  const parsed = parseGeminiJson(fenced);
  assert.strictEqual(parsed.summary, 'Weekly recap');
});

test('30. parseGeminiJson: returns null for malformed JSON without throwing', () => {
  const malformed = '{"title": invalid json }';
  assert.strictEqual(parseGeminiJson(malformed), null);
});

test('31. parseGeminiJson: returns null for empty or non-string input', () => {
  assert.strictEqual(parseGeminiJson(''), null);
  assert.strictEqual(parseGeminiJson(null), null);
  assert.strictEqual(parseGeminiJson(undefined), null);
});

test('32. isThisWeek: returns true for today', () => {
  assert.strictEqual(isThisWeek('2026-10-31', TODAY), true);
});

test('33. isThisWeek: returns true for tomorrow (+1 day)', () => {
  assert.strictEqual(isThisWeek('2026-11-01', TODAY), true);
});

test('34. isThisWeek: returns true for exactly +7 days boundary', () => {
  assert.strictEqual(isThisWeek('2026-11-07', TODAY), true);
});

test('35. isThisWeek: returns false for +8 days (beyond 7 days)', () => {
  assert.strictEqual(isThisWeek('2026-11-08', TODAY), false);
});

test('36. isThisWeek: returns false for yesterday (-1 day)', () => {
  assert.strictEqual(isThisWeek('2026-10-30', TODAY), false);
});

test('37. isThisWeek: returns false for invalid dates', () => {
  assert.strictEqual(isThisWeek('invalid-date', TODAY), false);
  assert.strictEqual(isThisWeek('', TODAY), false);
});

test('38. cleanAndCapNotices: purges notices older than 30 days and caps at max limit', () => {
  const notices = [
    { id: '1', title: 'Recent', date: TODAY },
    { id: '2', title: 'Old 40 days', date: '2026-09-01' }
  ];

  const cleaned = cleanAndCapNotices(notices, 200, 30);
  assert.strictEqual(cleaned.length, 1);
  assert.strictEqual(cleaned[0].title, 'Recent');
});

