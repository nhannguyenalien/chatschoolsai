import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackPublishedUrl, resolvePublishedUrl } from '../src/domain/publishing/publishedUrl.js';

const graphBase = 'https://graph.facebook.com/v19.0';
const never = async () => { throw new Error('network must not be used'); };

test('links derivable from the stored id need no network', () => {
  assert.equal(fallbackPublishedUrl('facebook', '123_456'), 'https://www.facebook.com/123_456');
  assert.equal(fallbackPublishedUrl('youtube', 'dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(fallbackPublishedUrl('wordpress', 'https://site.com/bai-viet/'), 'https://site.com/bai-viet/');
  for (const [platform, id] of [['instagram', '178'], ['facebook', ''], ['wordpress', 'http://insecure.com/x'], ['facebook', 'a b/../c'], ['wordpress', 'javascript:alert(1)']]) {
    assert.equal(fallbackPublishedUrl(platform, id), '');
  }
});

test('facebook and instagram use the permalink returned by Graph, sending the token in a header', async () => {
  let call;
  const fetchImpl = async (url, options) => { call = { url, options }; return Response.json({ permalink_url: 'https://www.facebook.com/page/posts/9' }); };
  const url = await resolvePublishedUrl({ platform: 'facebook', publishedId: '1_9', page: { access_token: 'tok' }, fetchImpl, graphBase });
  assert.equal(url, 'https://www.facebook.com/page/posts/9');
  assert.equal(call.url, `${graphBase}/1_9?fields=permalink_url`);
  assert.equal(call.options.headers.Authorization, 'Bearer tok');
  assert.ok(!call.url.includes('tok'));
  const ig = await resolvePublishedUrl({ platform: 'instagram', publishedId: '178', page: { access_token: 'tok' },
    fetchImpl: async () => Response.json({ permalink: 'https://www.instagram.com/p/ABC/' }), graphBase });
  assert.equal(ig, 'https://www.instagram.com/p/ABC/');
});

test('Graph failures fall back to the id-derived link and never throw', async () => {
  const page = { access_token: 'tok' };
  for (const fetchImpl of [async () => Response.json({ error: 'x' }, { status: 400 }), async () => { throw new Error('down'); },
    async () => Response.json({ permalink_url: 'javascript:alert(1)' })]) {
    assert.equal(await resolvePublishedUrl({ platform: 'facebook', publishedId: '1_9', page, fetchImpl, graphBase }), 'https://www.facebook.com/1_9');
    assert.equal(await resolvePublishedUrl({ platform: 'instagram', publishedId: '178', page, fetchImpl, graphBase }), '');
  }
});

test('wordpress ids are resolved through the REST API, sanity through the configured template', async () => {
  const wp = { page_id: 'https://site.com/', access_token: 'user:pass' };
  let seen;
  const fetchImpl = async (url, options) => { seen = { url, options }; return Response.json({ link: 'https://site.com/bai-moi/' }); };
  assert.equal(await resolvePublishedUrl({ platform: 'wordpress', publishedId: '42', page: wp, fetchImpl }), 'https://site.com/bai-moi/');
  assert.equal(seen.url, 'https://site.com/wp-json/wp/v2/posts/42');
  const sanity = { extra_config: JSON.stringify({ postUrlTemplate: 'https://site.com/blog/{slug}' }) };
  assert.equal(await resolvePublishedUrl({ platform: 'sanity', publishedId: 'doc1', page: sanity, post: { slug: 'xin chao' }, fetchImpl: never }), 'https://site.com/blog/xin%20chao');
  assert.equal(await resolvePublishedUrl({ platform: 'sanity', publishedId: 'doc1', page: {}, post: { slug: 's' }, fetchImpl: never }), '');
  assert.equal(await resolvePublishedUrl({ platform: 'facebook', publishedId: '', page: {}, fetchImpl: never }), '');
});
