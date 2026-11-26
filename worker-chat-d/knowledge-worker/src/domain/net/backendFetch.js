// Single calls from the Worker to PocketBase or AnythingLLM can hang until the full timeout while the next call
// succeeds at once. Calls that are safe to repeat get short attempts first, then one full-length attempt so a
// backend that is only slow still gets through.
export const DEFAULT_TIMEOUT_MS = 45e3;
export const SHORT_ATTEMPT_MS = 8e3;

// Only reads, logins and writes that set absolute values. Never creating records or asking the AI to answer.
const REPEATABLE = [
  ["GET", /\/api\/collections\/[^/]+\/records(\/[^/]+)?$/],
  // Account record: quota and billing write absolute values here.
  ["PATCH", /\/api\/collections\/tenants\/records\/[^/]+$/],
  ["POST", /\/api\/(collections\/_superusers|admins)\/auth-with-password$/],
  ["GET", /\/api\/v1\/system$/],
  ["GET", /\/api\/v1\/workspace\/[^/]+$/],
  ["POST", /\/api\/v1\/workspace\/[^/]+\/update$/]
];

function pathOf(resource) {
  try {
    return new URL(String(resource)).pathname;
  } catch {
    return "";
  }
}

export function isRepeatableCall(resource, method = "GET") {
  const path = pathOf(resource);
  return REPEATABLE.some(([verb, pattern]) => verb === method.toUpperCase() && pattern.test(path));
}

async function attempt(resource, options, timeout) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const upstreamSignal = options.signal;
  const signal = upstreamSignal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([controller.signal, upstreamSignal])
    : controller.signal;
  try {
    return await fetch(resource, { ...options, signal });
  } finally {
    clearTimeout(id);
  }
}

// A caller that sets its own timeout keeps a single attempt with that timeout.
export async function fetchWithTimeout(resource, options = {}, { shortMs = SHORT_ATTEMPT_MS } = {}) {
  const method = options.method || "GET";
  const timeouts = options.timeout === undefined && isRepeatableCall(resource, method)
    ? [shortMs, shortMs, DEFAULT_TIMEOUT_MS]
    : [options.timeout ?? DEFAULT_TIMEOUT_MS];
  for (let index = 0; ; index++) {
    try {
      return await attempt(resource, options, timeouts[index]);
    } catch (err) {
      if (index + 1 >= timeouts.length || options.signal?.aborted) throw err;
      // Path only: query strings carry tenant and session filters.
      console.warn(`[Backend] ${method} ${pathOf(resource)} lỗi (${err.name}), thử lại lần ${index + 2}`);
    }
  }
}
