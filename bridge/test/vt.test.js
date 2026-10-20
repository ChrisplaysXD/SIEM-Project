import test from 'node:test';
import assert from 'node:assert/strict';
import { createVtEnricher, isIp } from '../src/vt.js';

test('isIp accepts dotted quad, rejects garbage', () => {
  assert.equal(isIp('203.0.113.9'), true);
  assert.equal(isIp('999.1.1.1'), false);
  assert.equal(isIp('example.com'), false);
  assert.equal(isIp(''), false);
});

function fakeFetch(status, body) {
  const calls = [];
  const fn = async () => {
    calls.push(Date.now());
    if (status !== 200) {
      return { ok: false, status };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  };
  fn.calls = calls;
  return fn;
}

const vtBody = { data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 1 } } } };

test('lookup returns score and caches second call', async () => {
  const fetch = fakeFetch(200, vtBody);
  const vt = createVtEnricher({ apiKey: 'k', cacheTtlMs: 86400000, requestsPerMinute: 4, fetchImpl: fetch });
  const first = await vt.lookup('203.0.113.9');
  const second = await vt.lookup('203.0.113.9');
  assert.deepEqual(first, { score: 4, cached: false });
  assert.deepEqual(second, { score: 4, cached: true });
  assert.equal(fetch.calls.length, 1);
});

test('lookup throws on non-200 (caller degrades gracefully)', async () => {
  const fetch = fakeFetch(429, {});
  const vt = createVtEnricher({ apiKey: 'k', cacheTtlMs: 86400000, requestsPerMinute: 4, fetchImpl: fetch });
  await assert.rejects(() => vt.lookup('203.0.113.10'), /vt http 429/);
});

test('rate limit spaces requests across the minute window', async () => {
  let now = 0;
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const fetch = fakeFetch(200, vtBody);
    const vt = createVtEnricher({
      apiKey: 'k',
      cacheTtlMs: 0,
      requestsPerMinute: 4,
      fetchImpl: fetch,
      nowImpl: () => now,
      sleepImpl: async (ms) => {
        now += ms;
      },
    });
    await vt.lookup('1.1.1.1');
    await vt.lookup('1.1.1.2');
    await vt.lookup('1.1.1.3');
    assert.equal(fetch.calls.length, 3);
    const gaps = [fetch.calls[1] - fetch.calls[0], fetch.calls[2] - fetch.calls[1]];
    assert.ok(gaps.every((g) => g >= 15000 - 5), `gaps too small: ${gaps}`);
  } finally {
    Date.now = realNow;
  }
});
