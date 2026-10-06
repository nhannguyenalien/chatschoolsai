import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTargetPreflight, preflightNotice, PREFLIGHT_MARKER } from '../src/domain/publishing/preflight.js';

const page = { page_id: '123', access_token: 'tok' };
const okFetch = async (url) => (String(url).includes('graph.facebook.com')
  ? { ok: true, status: 200, json: async () => ({ id: '123' }) }
  : { ok: true, status: 200 });

test('healthy facebook target has no problems', async () => {
  const problems = await checkTargetPreflight({ target: { platform: 'facebook' }, page, post: { content: 'x' }, media: { url: 'https://cdn/x.png' }, fetchImpl: okFetch });
  assert.deepEqual(problems, []);
});

test('expired Meta token is reported', async () => {
  const fetchImpl = async (url) => (String(url).includes('graph.facebook.com')
    ? { ok: false, status: 400, json: async () => ({ error: { code: 190, message: 'expired' } }) }
    : { ok: true, status: 200 });
  const problems = await checkTargetPreflight({ target: { platform: 'facebook' }, page, post: {}, media: null, fetchImpl });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Token trang/);
});

test('instagram needs media and caption within limit', async () => {
  const noMedia = await checkTargetPreflight({ target: { platform: 'instagram' }, page, post: { content: 'x'.repeat(2300) }, media: null, fetchImpl: okFetch });
  assert.equal(noMedia.length, 2);
});

test('unreachable media is reported and HEAD 405 falls back to GET', async () => {
  const dead = async (url) => (String(url).includes('graph.facebook.com') ? { ok: true, status: 200, json: async () => ({}) } : { ok: false, status: 404 });
  assert.match((await checkTargetPreflight({ target: { platform: 'facebook' }, page, post: {}, media: { url: 'https://cdn/a.png' }, fetchImpl: dead }))[0], /URL ảnh/);
  const calls = [];
  const noHead = async (url, options) => {
    calls.push(options?.method);
    if (String(url).includes('graph.facebook.com')) return { ok: true, status: 200, json: async () => ({}) };
    return options.method === 'HEAD' ? { ok: false, status: 405 } : { ok: false, status: 206 === 206 ? 206 : 0 };
  };
  assert.deepEqual(await checkTargetPreflight({ target: { platform: 'facebook' }, page, post: {}, media: { url: 'https://cdn/a.png' }, fetchImpl: noHead }), []);
  assert.deepEqual(calls.filter(Boolean), ['HEAD', 'GET']);
});

test('network failure while checking the token is not reported as a problem', async () => {
  const fetchImpl = async (url) => { if (String(url).includes('graph.facebook.com')) throw new TypeError('fetch failed'); return { ok: true, status: 200 }; };
  assert.deepEqual(await checkTargetPreflight({ target: { platform: 'facebook' }, page, post: {}, media: null, fetchImpl }), []);
});

test('notice starts with the marker', () => {
  assert.ok(preflightNotice({ platform: 'facebook', problems: ['a'] }).startsWith(PREFLIGHT_MARKER));
});
