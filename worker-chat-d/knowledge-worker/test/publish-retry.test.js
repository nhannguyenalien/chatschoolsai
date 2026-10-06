import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPublishError, failureNotice, metaApiError, nextRetryAt } from '../src/domain/publishing/retryPolicy.js';

const meta = (status, code, extra = {}) => metaApiError({ status }, { error: { message: 'm', code, ...extra } }, 'fallback');

test('Meta rate limit and transient errors are retryable', () => {
  assert.equal(classifyPublishError(meta(400, 4)).kind, 'retryable');
  assert.equal(classifyPublishError(meta(400, 17)).reason, 'rate_limit');
  assert.equal(classifyPublishError(meta(500, 2)).reason, 'transient');
  assert.equal(classifyPublishError(meta(503, undefined)).kind, 'retryable');
  assert.equal(classifyPublishError(meta(429, undefined)).reason, 'rate_limit');
  assert.equal(classifyPublishError(meta(400, 99, { is_transient: true })).kind, 'retryable');
});

test('token, permission and rejected errors are permanent', () => {
  assert.deepEqual(classifyPublishError(meta(400, 190)), { kind: 'permanent', reason: 'token' });
  assert.equal(classifyPublishError(meta(403, 200)).reason, 'permission');
  assert.equal(classifyPublishError(meta(400, 368)).reason, 'permission');
  assert.equal(classifyPublishError(meta(400, 100)).reason, 'rejected');
  assert.equal(classifyPublishError(new Error('Instagram bắt buộc phải có ảnh')).kind, 'permanent');
});

test('timeouts are uncertain and never retried automatically', () => {
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  assert.deepEqual(classifyPublishError(abort), { kind: 'uncertain', reason: 'timeout' });
  assert.equal(classifyPublishError(new TypeError('fetch failed')).kind, 'uncertain');
});

test('retry schedule backs off and stops after three retries', () => {
  const now = new Date('2026-10-03T00:00:00.000Z');
  assert.equal(nextRetryAt(0, now), '2026-10-03T00:15:00.000Z');
  assert.equal(nextRetryAt(1, now), '2026-10-03T01:00:00.000Z');
  assert.equal(nextRetryAt(2, now), '2026-10-03T04:00:00.000Z');
  assert.equal(nextRetryAt(3, now), null);
});

test('failure notice explains the reason and warns about duplicates on timeout', () => {
  const text = failureNotice({ reason: 'timeout', title: 'Bài A', platform: 'facebook', message: 'x', attempts: 0 });
  assert.match(text, /facebook/);
  assert.match(text, /KIỂM TRA TRANG/);
  assert.doesNotMatch(text, /Đã thử lại/);
  assert.match(failureNotice({ reason: 'rate_limit', attempts: 3 }), /Đã thử lại 3 lần/);
});
