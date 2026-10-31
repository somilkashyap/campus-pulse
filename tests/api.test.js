/**
 * Automated tests for api/gemini.js handler behaviour.
 * Tests are written against the handler's observable HTTP responses only —
 * no dependency on any named exports (the current gemini.js does not export helpers).
 *
 * Uses Node.js built-in test runner (node:test, node:assert).
 * Zero external dependencies.
 */

const test = require('node:test');
const assert = require('node:assert');

// Load the handler (default export)
const handler = require('../api/gemini.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock response object compatible with the handler.
 * Captures _status and _body for assertions.
 */
function makeMockRes() {
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this; // allow .status(405).json(...)
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

/**
 * Makes a minimal POST request object.
 * Uses a unique IP suffix to avoid sharing rate-limit buckets across tests.
 */
let ipCounter = 0;
function makePostReq(body, ipSuffix) {
  const ip = `10.test.${ipSuffix !== undefined ? ipSuffix : ++ipCounter}.1`;
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body,
  };
}

// ---------------------------------------------------------------------------
// METHOD VALIDATION
// ---------------------------------------------------------------------------

test('1. handler: GET request returns 405 Method Not Allowed', async () => {
  const req = { method: 'GET', headers: {}, body: {} };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 405);
  assert.ok(res._body && typeof res._body.error === 'string', 'Should have an error string');
});

test('2. handler: PUT request returns 405 Method Not Allowed', async () => {
  const req = { method: 'PUT', headers: {}, body: {} };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 405);
});

// ---------------------------------------------------------------------------
// EXTRACTION INPUT VALIDATION  (POST { text, today })
// ---------------------------------------------------------------------------

test('3. handler: POST with no body returns 400 or 500 (not 200)', async () => {
  const req = makePostReq({});
  const res = makeMockRes();
  await handler(req, res);
  // Must reject — could be 400 (validation) or 500 (no API key checked first)
  assert.ok(res._status === 400 || res._status === 500,
    `Expected 400 or 500, got ${res._status}`);
});

test('4. handler: POST with empty text string returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  // We need to reach text validation, but the key check happens before validation
  // in the current code. Set a fake key so we reach validation.
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ text: '', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  // Restore
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
  assert.ok(res._body && typeof res._body.error === 'string');
});

test('5. handler: POST with whitespace-only text returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ text: '   \n\t  ', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
});

test('6. handler: POST with text of exactly 3001 chars returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ text: 'x'.repeat(3001), today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
  assert.ok(res._body && res._body.error && res._body.error.includes('3000'),
    'Error should mention the 3000-char limit');
});

test('7. handler: POST with text of exactly 3000 chars passes validation (reaches API key check)', async () => {
  // With no real API key the handler returns 500, not 400.
  // A 500 here proves that text validation passed (400 would mean it failed).
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = makePostReq({ text: 'c'.repeat(3000), today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  assert.notStrictEqual(res._status, 400,
    '3000-char text should pass input validation and not return 400');
});

test('8. handler: POST with valid short text but no API key returns 500', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = makePostReq({ text: 'Exam on Friday in LT-2 at 10am', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  assert.strictEqual(res._status, 500);
  assert.ok(res._body && typeof res._body.error === 'string');
});

// ---------------------------------------------------------------------------
// SUMMARY INPUT VALIDATION  (POST { type: "summary", items, today })
// ---------------------------------------------------------------------------

test('9. handler: POST summary with empty items array returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ type: 'summary', items: [], today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
  assert.ok(res._body && typeof res._body.error === 'string');
});

test('10. handler: POST summary with non-array items returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ type: 'summary', items: 'not-an-array', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
});

test('11. handler: POST summary with null items returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key-for-validation-test';

  const req = makePostReq({ type: 'summary', items: null, today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
});

test('12. handler: POST summary with valid items but no API key returns 500', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = makePostReq({
    type: 'summary',
    items: [{ title: 'Exam', date: '2026-11-03', category: 'Academic' }],
    today: '2026-11-01',
  });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  assert.strictEqual(res._status, 500);
});

// ---------------------------------------------------------------------------
// RATE LIMITING
// Each test uses its own unique IP (via ipCounter) so tests never share buckets.
// ---------------------------------------------------------------------------

test('13. handler: first 10 requests from the same IP all pass rate limit', async () => {
  // Use a single unique IP for this test only
  const ip = `10.rl.uniq.${Date.now()}`;
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY; // so handler returns 500 quickly, not calling Gemini

  const statuses = [];
  for (let i = 0; i < 10; i++) {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: { text: 'Valid notice text for rate limit test.', today: '2026-11-01' },
    };
    const res = makeMockRes();
    await handler(req, res);
    statuses.push(res._status);
  }

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  // All 10 should reach the API-key check (500), not be rate-limited (429)
  for (let i = 0; i < 10; i++) {
    assert.notStrictEqual(statuses[i], 429, `Call ${i + 1} should not be rate-limited`);
  }
});

test('14. handler: 11th request from the same IP returns 429 Too Many Requests', async () => {
  const ip = `10.rl.11th.${Date.now()}`;
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  // Exhaust the 10-request budget
  for (let i = 0; i < 10; i++) {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: { text: 'Rate limit exhaust', today: '2026-11-01' },
    };
    await handler(req, makeMockRes());
  }

  // 11th request
  const req11 = {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: { text: 'Should be rate limited', today: '2026-11-01' },
  };
  const res11 = makeMockRes();
  await handler(req11, res11);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  assert.strictEqual(res11._status, 429);
  assert.ok(res11._body && typeof res11._body.error === 'string',
    'Should return a descriptive rate-limit error message');
});

test('15. handler: a different IP is not blocked when another IP hits the rate limit', async () => {
  const ipA = `10.rl.ipA.${Date.now()}`;
  const ipB = `10.rl.ipB.${Date.now()}`;
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  // Exhaust ipA
  for (let i = 0; i < 10; i++) {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': ipA },
      body: { text: 'Exhaust ipA', today: '2026-11-01' },
    };
    await handler(req, makeMockRes());
  }

  // Confirm ipA is now blocked
  const resA = makeMockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': ipA },
    body: { text: 'ipA 11th', today: '2026-11-01' },
  }, resA);

  // ipB should still pass (returns 500 for no API key, not 429)
  const resB = makeMockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': ipB },
    body: { text: 'ipB first request', today: '2026-11-01' },
  }, resB);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  assert.strictEqual(resA._status, 429, 'ipA should be rate-limited');
  assert.notStrictEqual(resB._status, 429, 'ipB should not be rate-limited');
});

// ---------------------------------------------------------------------------
// BODY PARSING EDGE CASES
// ---------------------------------------------------------------------------

test('16. handler: POST with string body (JSON string) is parsed correctly', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  // Some Vercel setups pass body as a raw JSON string
  const req = makePostReq(JSON.stringify({ text: '', today: '2026-11-01' }));
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  // Empty text should yield 400 after parsing the string body
  assert.strictEqual(res._status, 400);
});

test('17. handler: POST with malformed JSON string body returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  const req = makePostReq('this is { not : valid json');
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
});

// ---------------------------------------------------------------------------
// SUCCESSFUL PATH (mocked fetch)
// ---------------------------------------------------------------------------

test('18. handler: POST with valid text and mocked Gemini returns 200 with notices array', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  // Mock global fetch
  const originalFetch = global.fetch;
  const fakeNotice = {
    title: 'Semester Exam',
    date: '2026-11-05',
    time: '10:00 AM',
    venue: 'LT-3',
    category: 'Academic',
    description: 'End semester examination.',
  };
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify([fakeNotice]) }],
        },
      }],
    }),
  });

  const req = makePostReq({ text: 'Exam on 5th Nov at LT-3', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  // Restore
  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 200);
  assert.ok(Array.isArray(res._body.notices), 'Response should have a notices array');
  assert.strictEqual(res._body.notices.length, 1);
  assert.strictEqual(res._body.notices[0].title, 'Semester Exam');
});

test('19. handler: POST summary with valid items and mocked Gemini returns 200 with summary', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ summary: '📅 This week: Exam on Wed, Seminar on Thu.' }) }],
        },
      }],
    }),
  });

  const req = makePostReq({
    type: 'summary',
    items: [
      { title: 'Exam', date: '2026-11-05', category: 'Academic', description: 'Mid-sem exam.' },
    ],
    today: '2026-11-01',
  });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 200);
  assert.ok(typeof res._body.summary === 'string', 'Response should have a summary string');
  assert.ok(res._body.summary.length > 0);
});

test('20. handler: POST extraction when Gemini returns code-fenced JSON still parses correctly', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  const originalFetch = global.fetch;
  const fakeNotice = {
    title: 'Workshop on AI',
    date: '2026-11-06',
    time: '02:00 PM',
    venue: 'Seminar Hall',
    category: 'Event',
    description: 'AI Workshop for all students.',
  };
  // Simulate Gemini wrapping its response in ```json ... ```
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: '```json\n' + JSON.stringify([fakeNotice]) + '\n```' }],
        },
      }],
    }),
  });

  const req = makePostReq({ text: 'AI workshop next Thursday at Seminar Hall at 2pm', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 200);
  assert.ok(Array.isArray(res._body.notices));
  assert.strictEqual(res._body.notices[0].title, 'Workshop on AI');
});

test('21. handler: POST extraction when Gemini API call fails returns 502', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'Service Unavailable',
  });

  const req = makePostReq({ text: 'Exam notice text here', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 502);
  assert.ok(res._body && typeof res._body.error === 'string');
});

test('22. handler: POST extraction when Gemini returns empty candidate returns 502', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [] }),
  });

  const req = makePostReq({ text: 'Some notice text', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 502);
});

test('23. handler: text of exactly 3000 chars is accepted (not rejected)', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'Unauthorized',
  });

  const req = makePostReq({ text: 'z'.repeat(3000), today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  // Must NOT be a 400 (input validation must pass); 502 expected from fake key failure
  assert.notStrictEqual(res._status, 400, '3000-char text must pass input validation');
});

test('24. handler: summary with object (not array) items returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  const req = makePostReq({ type: 'summary', items: { title: 'Not an array' }, today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
});

test('25. handler: x-forwarded-for with comma-separated IPs uses only the first IP for rate limiting', async () => {
  // Exhaust rate limit using comma-formatted forwarded IP
  const baseIp = `10.fwd.${Date.now()}`;
  const forwardedHeader = `${baseIp}, 10.proxy.1, 10.proxy.2`;

  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  for (let i = 0; i < 10; i++) {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': forwardedHeader },
      body: { text: 'Notice text', today: '2026-11-01' },
    }, makeMockRes());
  }

  const res11 = makeMockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': forwardedHeader },
    body: { text: 'Should be limited', today: '2026-11-01' },
  }, res11);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;

  // If the handler correctly extracts just the first IP, the 11th call is rate-limited
  assert.strictEqual(res11._status, 429,
    'Should correctly parse the first IP from x-forwarded-for chain');
});

test('26. handler: response for 405 includes Allow header set to POST', async () => {
  const req = { method: 'DELETE', headers: {}, body: {} };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 405);
  assert.ok(res._headers['Allow'], 'Allow header should be set');
});

test('27. handler: POST with text just over limit (3001 chars) includes limit in error message', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  const req = makePostReq({ text: 'a'.repeat(3001), today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400);
  assert.ok(
    res._body && typeof res._body.error === 'string' && res._body.error.includes('3000'),
    'Error message should mention the 3000-char limit'
  );
});

test('28. handler: extraction with Gemini returning single object (not array) wraps it', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-api-key';

  const originalFetch = global.fetch;
  const singleNotice = {
    title: 'Single Notice',
    date: '2026-11-10',
    time: '09:00 AM',
    venue: 'Room 101',
    category: 'Academic',
    description: 'Single notice returned as object, not array.',
  };
  // Gemini returns a single object instead of array — handler should wrap it
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(singleNotice) }] },
      }],
    }),
  });

  const req = makePostReq({ text: 'Single notice content', today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  global.fetch = originalFetch;
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 200);
  assert.ok(Array.isArray(res._body.notices), 'Handler should wrap single object in array');
  assert.strictEqual(res._body.notices[0].title, 'Single Notice');
});

test('29. handler: POST summary items payload larger than 15000 chars returns 400', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-key';

  // Build an items array where the serialised JSON exceeds 15000 chars
  const hugeItems = Array.from({ length: 60 }, (_, i) => ({
    title: `Notice ${i}`,
    date: '2026-11-05',
    time: '10:00 AM',
    venue: 'A'.repeat(100),
    category: 'Academic',
    description: 'D'.repeat(300),
  }));

  const req = makePostReq({ type: 'summary', items: hugeItems, today: '2026-11-01' });
  const res = makeMockRes();
  await handler(req, res);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;

  assert.strictEqual(res._status, 400,
    'Payload exceeding 15000 chars should be rejected with 400');
});

test('30. handler: error body always contains an "error" string property', async () => {
  // Test multiple error scenarios and confirm the shape is consistent
  const scenarios = [
    // [method, body, ip]
    ['GET', {}, 'err-shape-1'],
    ['POST', {}, 'err-shape-2'],
  ];

  for (const [method, body, ipSuffix] of scenarios) {
    const req = { method, headers: { 'x-forwarded-for': ipSuffix }, body };
    const res = makeMockRes();
    await handler(req, res);
    assert.ok(
      res._body && typeof res._body.error === 'string' && res._body.error.length > 0,
      `Scenario [${method}] should return { error: string }, got: ${JSON.stringify(res._body)}`
    );
  }
});
