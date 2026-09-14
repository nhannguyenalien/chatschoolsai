import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tenant API cannot create another tenant without the system admin secret", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const handler = source.slice(
    source.indexOf("async function handleApiCreateBot"),
    source.indexOf('__name(handleApiCreateBot, "handleApiCreateBot")')
  );

  assert.match(handler, /request\.headers\.get\("X-Admin-Secret"\)/);
  assert.match(handler, /providedKey !== env\.ADMIN_SECRET/);
  assert.match(handler, /status: 403/);
  assert.ok(
    handler.indexOf("providedKey !== env.ADMIN_SECRET") < handler.indexOf("createBotConfig"),
    "authorization must happen before tenant creation"
  );
});
