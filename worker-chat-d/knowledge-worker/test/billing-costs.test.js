import test from 'node:test';
import assert from 'node:assert/strict';
import { COST_TABLE, costKindForPath, docEmbedUnits, voiceUnits } from '../src/domain/billing/costs.js';

test('a post with one AI image costs 10 units', () => {
  assert.equal(COST_TABLE.post_text + COST_TABLE.image, 10);
});

test('document embedding scales with size, min 1 and max 20', () => {
  assert.equal(docEmbedUnits(0), 1);
  assert.equal(docEmbedUnits(20000), 1);
  assert.equal(docEmbedUnits(20001), 2);
  assert.equal(docEmbedUnits(100000), 5);
  assert.equal(docEmbedUnits(500000), 20);
  assert.equal(docEmbedUnits(5e7), 20);
});

test('voice costs 4 units per minute, at least 1', () => {
  assert.equal(voiceUnits(0), 1);
  assert.equal(voiceUnits(5), 1);
  assert.equal(voiceUnits(15), 1);
  assert.equal(voiceUnits(60), 4);
  assert.equal(voiceUnits(120), 8);
});

test('image generation path is detected, other paths keep the caller kind', () => {
  assert.equal(costKindForPath('/v1/images/generations'), 'image');
  assert.equal(costKindForPath('/v1/chat/completions', 'post_text'), 'post_text');
  assert.equal(costKindForPath('/v1/chat/completions'), 'chat');
});

test('describing an uploaded photo with AI costs 1 reply unit and keeps its own kind', () => {
  assert.equal(COST_TABLE.image_describe, 1);
  assert.equal(costKindForPath('/v1/chat/completions', 'image_describe'), 'image_describe');
});
