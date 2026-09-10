import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/index.js";

function fakeDurableObjectState() {
  const store = new Map();
  return {
    storage: {
      async get(key) { return store.get(key); },
      async put(key, value) { store.set(key, value); },
    },
  };
}

test("RateLimiter allows requests under the limit and rejects once the window is full", async () => {
  const limiter = new RateLimiter(fakeDurableObjectState());
  const check = () => limiter.fetch(new Request("https://rate-limiter/check", {
    method: "POST",
    body: JSON.stringify({ limit: 3, windowMs: 60000 }),
  }));

  assert.equal((await check()).status, 200);
  assert.equal((await check()).status, 200);
  assert.equal((await check()).status, 200);
  const blocked = await check();
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).allowed, false);
});

test("RateLimiter tracks each key (durable object instance) independently", async () => {
  const a = new RateLimiter(fakeDurableObjectState());
  const b = new RateLimiter(fakeDurableObjectState());
  const hit = (limiter) => limiter.fetch(new Request("https://rate-limiter/check", {
    method: "POST",
    body: JSON.stringify({ limit: 1, windowMs: 60000 }),
  }));

  assert.equal((await hit(a)).status, 200);
  assert.equal((await hit(a)).status, 429);
  assert.equal((await hit(b)).status, 200);
});
