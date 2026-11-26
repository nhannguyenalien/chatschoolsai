import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithTimeout, isRepeatableCall } from '../src/domain/net/backendFetch.js';

const PB = 'https://pb.test/api';
const LLM = 'https://ai.test/api/v1';

test('only reads, logins and absolute writes are repeatable', () => {
  assert(isRepeatableCall(`${PB}/collections/bot_configs/records?filter=x`));
  assert(isRepeatableCall(`${PB}/collections/tenants/records/a1`, 'PATCH'));
  assert(isRepeatableCall(`${PB}/collections/_superusers/auth-with-password`, 'POST'));
  assert(isRepeatableCall(`${PB}/admins/auth-with-password`, 'post'));
  assert(isRepeatableCall(`${LLM}/system`));
  assert(isRepeatableCall(`${LLM}/workspace/estate`));
  assert(isRepeatableCall(`${LLM}/workspace/estate/update`, 'POST'));
  assert(!isRepeatableCall(`${PB}/collections/messages/records`, 'POST'));
  assert(!isRepeatableCall(`${PB}/collections/messages/records/m1`, 'PATCH'));
  assert(!isRepeatableCall(`${PB}/collections/posts/records/p1`, 'DELETE'));
  assert(!isRepeatableCall(`${LLM}/workspace/estate/chat`, 'POST'));
  assert(!isRepeatableCall(`${LLM}/workspace/new`, 'POST'));
  assert(!isRepeatableCall('https://api.openai.com/v1/chat/completions', 'POST'));
  assert(!isRepeatableCall('not a url'));
});

// A fetch that hangs for the first `hangs` calls, until it is aborted.
async function withHangingFetch(hangs, run) {
  const original = globalThis.fetch;
  const warn = console.warn;
  const calls = [];
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  globalThis.fetch = (url, options) => {
    calls.push(url);
    if (calls.length > hangs) return Promise.resolve(new Response('ok'));
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  };
  try { await run({ calls, warnings }); } finally { globalThis.fetch = original; console.warn = warn; }
}

test('a hung read is retried and the query string stays out of the log', async () => {
  await withHangingFetch(1, async ({ calls, warnings }) => {
    const response = await fetchWithTimeout(`${PB}/collections/bot_configs/records?filter=secret-session`, {}, { shortMs: 5 });
    assert.equal(await response.text(), 'ok');
    assert.equal(calls.length, 2);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0], /secret-session/);
  });
});

test('two hung attempts still leave a final full-length attempt', async () => {
  await withHangingFetch(2, async ({ calls }) => {
    assert.equal((await fetchWithTimeout(`${LLM}/system`, {}, { shortMs: 5 })).status, 200);
    assert.equal(calls.length, 3);
  });
});

test('creating a record, an explicit timeout and a caller abort are not repeated', async () => {
  await withHangingFetch(9, async ({ calls }) => {
    await assert.rejects(fetchWithTimeout(`${PB}/collections/messages/records`, { method: 'POST', timeout: 5 }));
    await assert.rejects(fetchWithTimeout(`${PB}/collections/bot_configs/records`, { timeout: 5 }));
    assert.equal(calls.length, 2);
    const controller = new AbortController();
    const pending = fetchWithTimeout(`${LLM}/system`, { signal: controller.signal }, { shortMs: 1000 });
    controller.abort();
    await assert.rejects(pending);
    assert.equal(calls.length, 3);
  });
});
