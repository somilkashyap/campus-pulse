/**
 * Automated tests for api/gemini.js input validation and rate limiting.
 * Uses Node.js built-in test runner (node:test, node:assert).
 * Zero external dependencies. fetch is mocked globally where needed.
 */

const test = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------------------
// Load the exported helpers from api/gemini.js
// The Vercel handler is the default export; helpers are named exports.
// ---------------------------------------------------------------------------
const {
  checkRateLimit,
  resetRateLimit,
  validateExtractInput,
  validateSummaryInput,
  rateLimitMap,
} = require('../api/gemini.js');

// ============================================================
// validateExtractInput — input validation for extraction mode
// ============================================================

test('1. validateExtractInput: empty string is invalid', () => {
  const result = validateExtractInput('');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error, 'Should provide an error message');
});

test('2. validateExtractInput: null is invalid', () => {
  const result = validateExtractInput(null);
  assert.strictEqual(result.valid, false);
});

test('3. validateExtractInput: undefined is invalid', () => {
  const result = validateExtractInput(undefined);
  assert.strictEqual(result.valid, false);
});

test('4. validateExtractInput: whitespace-only string is invalid', () => {
  const result = validateExtractInput('   \n\t  ');
  assert.strictEqual(result.valid, false);
});

test('5. validateExtractInput: text over 3000 chars is invalid', () => {
  const longText = 'a'.repeat(3001);
  const result = validateExtractInput(longText);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error && result.error.includes('3000'), 'Error should mention 3000');
});

test('6. validateExtractInput: text of exactly 3001 chars is invalid', () => {
  const longText = 'b'.repeat(3001);
  const result = validateExtractInput(longText);
  assert.strictEqual(result.valid, false);
});

test('7. validateExtractInput: text of exactly 3000 chars is valid', () => {
  const exactText = 'c'.repeat(3000);
  const result = validateExtractInput(exactText);
  assert.strictEqual(result.valid, true);
});

test('8. validateExtractInput: normal notice text is valid', () => {
  const result = validateExtractInput('Exam on Monday at 10am in Room 201');
  assert.strictEqual(result.valid, true);
});

test('9. validateExtractInput: non-string value (number) is invalid', () => {
  const result = validateExtractInput(42);
  assert.strictEqual(result.valid, false);
});

test('10. validateExtractInput: Hinglish text is valid', () => {
  const result = validateExtractInput('Kal 3 baje seminar hai LT-1 mein, compulsory attendance.');
  assert.strictEqual(result.valid, true);
});

// ============================================================
// validateSummaryInput — input validation for summary mode
// ============================================================

test('11. validateSummaryInput: empty array is invalid', () => {
  const result = validateSummaryInput([]);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error, 'Should provide an error message');
});

test('12. validateSummaryInput: null is invalid', () => {
  const result = validateSummaryInput(null);
  assert.strictEqual(result.valid, false);
});

test('13. validateSummaryInput: undefined is invalid', () => {
  const result = validateSummaryInput(undefined);
  assert.strictEqual(result.valid, false);
});

test('14. validateSummaryInput: a plain object (not array) is invalid', () => {
  const result = validateSummaryInput({ title: 'Test' });
  assert.strictEqual(result.valid, false);
});

test('15. validateSummaryInput: a string is invalid', () => {
  const result = validateSummaryInput('just a string');
  assert.strictEqual(result.valid, false);
});

test('16. validateSummaryInput: valid array with one item is valid', () => {
  const result = validateSummaryInput([{ title: 'Exam', date: '2026-11-01' }]);
  assert.strictEqual(result.valid, true);
});

test('17. validateSummaryInput: valid array with multiple items is valid', () => {
  const items = [
    { title: 'Exam', date: '2026-11-01' },
    { title: 'Seminar', date: '2026-11-03' },
    { title: 'Deadline', date: '2026-11-05' },
  ];
  const result = validateSummaryInput(items);
  assert.strictEqual(result.valid, true);
});

// ============================================================
// checkRateLimit & resetRateLimit — sliding window rate limiter
// ============================================================

test('18. checkRateLimit: first 10 calls from same IP all pass', () => {
  resetRateLimit(); // clear state before test
  const ip = 'test-ip-rate-18';
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(checkRateLimit(ip), true, `Call ${i + 1} should pass`);
  }
});

test('19. checkRateLimit: 11th call from same IP within window is blocked', () => {
  resetRateLimit();
  const ip = 'test-ip-rate-19';
  for (let i = 0; i < 10; i++) {
    checkRateLimit(ip);
  }
  assert.strictEqual(checkRateLimit(ip), false, '11th call should be blocked');
});

test('20. checkRateLimit: different IP is unaffected by another IP being rate-limited', () => {
  resetRateLimit();
  const ipA = 'test-ip-A';
  const ipB = 'test-ip-B';

  // Exhaust ipA
  for (let i = 0; i < 10; i++) {
    checkRateLimit(ipA);
  }
  // ipA should be blocked
  assert.strictEqual(checkRateLimit(ipA), false, 'ipA should be blocked');
  // ipB should still pass
  assert.strictEqual(checkRateLimit(ipB), true, 'ipB should be unaffected');
});

test('21. checkRateLimit: resetRateLimit clears all state so requests pass again', () => {
  const ip = 'test-ip-reset-21';
  // Exhaust this IP
  for (let i = 0; i < 10; i++) {
    checkRateLimit(ip);
  }
  assert.strictEqual(checkRateLimit(ip), false, 'Should be blocked before reset');

  resetRateLimit();
  assert.strictEqual(checkRateLimit(ip), true, 'Should pass again after reset');
});

test('22. checkRateLimit: each call increments count (9th passes, 10th passes, 11th fails)', () => {
  resetRateLimit();
  const ip = 'test-ip-count-22';
  for (let i = 0; i < 9; i++) checkRateLimit(ip);
  assert.strictEqual(checkRateLimit(ip), true, '10th call should still pass');
  assert.strictEqual(checkRateLimit(ip), false, '11th call should be blocked');
});

// ============================================================
// Full handler tests — with mocked req/res and fetch
// ============================================================

/**
 * Creates a minimal mock response object compatible with the handler.
 * Captures statusCode and body for assertions.
 */
function makeMockRes() {
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this; // for chaining: res.status(405).json(...)
    },
    json(body) {
      this._body = body;
      return this;
    },
    setHeader(name, value) {
      this._headers[name] = value;
    },
  };
  return res;
}

// Load the full handler (default export)
const handler = require('../api/gemini.js');

test('23. handler: GET request returns 405 Method Not Allowed', async () => {
  resetRateLimit();
  const req = { method: 'GET', headers: {}, body: {} };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 405);
  assert.ok(res._body && res._body.error, 'Should have an error message');
});

test('24. handler: POST with no text returns 400 Bad Request', async () => {
  resetRateLimit();
  const req = { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: {} };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 400);
});

test('25. handler: POST with text over 3000 chars returns 400', async () => {
  resetRateLimit();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.5' },
    body: { text: 'x'.repeat(3001), today: '2026-10-31' },
  };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 400);
});

test('26. handler: POST is rate-limited after 10 requests and returns 429', async () => {
  resetRateLimit();
  const ip = '10.0.0.1';

  // Exhaust rate limit without hitting the actual Gemini API:
  // Provide text so input validation passes, but let the handler reach the
  // API key check (it will 500 since GEMINI_API_KEY isn't set in test env).
  // We only need 10 iterations to consume the budget.
  const reqTemplate = {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: { text: 'Valid notice text for rate limit test.', today: '2026-10-31' },
  };

  for (let i = 0; i < 10; i++) {
    const res = makeMockRes();
    await handler(reqTemplate, res);
    // These will 500 (no API key) but that's fine — rate limit is counted
  }

  // 11th request should be rate-limited
  const finalRes = makeMockRes();
  await handler(reqTemplate, finalRes);
  assert.strictEqual(finalRes._status, 429);
  assert.ok(finalRes._body && finalRes._body.error, 'Should return a rate limit error message');
});

test('27. handler: POST without GEMINI_API_KEY set returns 500', async () => {
  resetRateLimit();
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '2.3.4.5' },
    body: { text: 'Exam tomorrow in LT-3 at 9am', today: '2026-10-31' },
  };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 500);

  // Restore
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
});

test('28. handler: POST summary mode with empty items returns 400', async () => {
  resetRateLimit();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '3.4.5.6' },
    body: { type: 'summary', items: [], today: '2026-10-31' },
  };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 400);
});

test('29. handler: POST summary mode with non-array items returns 400', async () => {
  resetRateLimit();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '3.4.5.7' },
    body: { type: 'summary', items: 'not-an-array', today: '2026-10-31' },
  };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 400);
});

test('30. handler: POST summary with valid items but no API key returns 500', async () => {
  resetRateLimit();
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '4.5.6.7' },
    body: {
      type: 'summary',
      items: [{ title: 'Exam', date: '2026-11-01', category: 'Academic' }],
      today: '2026-10-31',
    },
  };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 500);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
});
