import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfigSnapshot } from '../src/index.js';

// The config agent used to answer "0 posts scheduled this week" because it only saw
// publish_schedules (recurring rules) and never the real post_targets.
test('config snapshot exposes real scheduled, published and failed posts, not only recurring rules', async () => {
  const realFetch = globalThis.fetch;
  const urls = [];
  const target = (extra) => ({ platform: 'facebook', updated: '2026-10-15 01:00:00.000Z', expand: { post_id: { title: 'Bai thu nhat' } }, ...extra });
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    urls.push(url);
    const reply = (body) => Response.json(body);
    if (!url.includes('/post_targets/')) return reply({ items: [], totalItems: 0 });
    if (url.includes("status='scheduled' && scheduled_at = ''")) return reply({ items: [{}], totalItems: 2 });
    if (url.includes("status='scheduled'") && url.includes('<=')) return reply({ items: [{}], totalItems: 12 });
    if (url.includes("status='scheduled'")) return reply({ items: [target({ scheduled_at: '2026-10-21 21:00:00.000Z' })], totalItems: 30 });
    if (url.includes("status='published'")) return reply({ items: [target({ status: 'published', platform: 'youtube', published_post_id: 'dQw4w9WgXcQ' })], totalItems: 16 });
    if (url.includes("status='error'")) return reply({ items: [target({ error_log: 'token het han' })], totalItems: 1 });
    return reply({ items: [], totalItems: 4 });
  };
  try {
    const snapshot = await getConfigSnapshot({ PB_URL: 'https://pb.test' }, 'token', { tenant: 'shop-a' });
    assert.deepEqual(snapshot.publish_schedules, []);
    const publishing = snapshot.publishing;
    assert.equal(publishing.scheduled_upcoming_total, 30);
    assert.equal(publishing.scheduled_next_7_days, 12);
    assert.equal(publishing.queued_waiting_for_auto_slot, 2);
    assert.equal(publishing.pending_approval, 4);
    assert.equal(publishing.published_last_7_days, 16);
    assert.equal(publishing.errors_total, 1);
    assert.deepEqual(publishing.upcoming[0], { platform: 'facebook', scheduled_at: '2026-10-21 21:00:00.000Z', updated: '2026-10-15 01:00:00.000Z', title: 'Bai thu nhat', error: undefined, url: undefined });
    assert.equal(publishing.recent_errors[0].error, 'token het han');
    assert.equal(publishing.recently_published[0].url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    // Every post_targets query is scoped to the tenant and uses PocketBase's date format (space, not T).
    const queries = urls.filter((url) => url.includes('/post_targets/'));
    assert.equal(queries.length, 6);
    assert.ok(queries.every((url) => url.includes("tenant='shop-a'")));
    assert.ok(queries.filter((url) => url.includes('>=')).every((url) => !/>= '\d{4}-\d\d-\d\dT/.test(url)));
  } finally { globalThis.fetch = realFetch; }
});
