import assert from "node:assert/strict";
import test from "node:test";

import { callInternalHandlerWithForcedTenant } from "../src/index.js";

test("AI voice multipart keeps audio and forces tenant from the API key", async () => {
  const form = new FormData();
  form.append("tenant", "attacker-workspace");
  form.append("session", "voice-session-1");
  form.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "voice.webm");

  const request = new Request("https://example.test/api/v1/ai-voice/turn", {
    method: "POST",
    body: form
  });

  const response = await callInternalHandlerWithForcedTenant(
    request,
    {},
    { "Content-Type": "application/json" },
    "trusted-workspace",
    async (forcedRequest) => {
      const forcedForm = await forcedRequest.formData();
      const audio = forcedForm.get("audio");
      return Response.json({
        tenant: forcedForm.get("tenant"),
        session: forcedForm.get("session"),
        audioType: audio.type,
        audioSize: audio.size
      });
    }
  );

  assert.deepEqual(await response.json(), {
    tenant: "trusted-workspace",
    session: "voice-session-1",
    audioType: "audio/webm",
    audioSize: 3
  });
});

test("tenant forcing still supports JSON requests", async () => {
  const request = new Request("https://example.test/api/v1/ai-voice/greeting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant: "attacker-workspace", lang: "vi" })
  });

  const response = await callInternalHandlerWithForcedTenant(
    request,
    {},
    { "Content-Type": "application/json" },
    "trusted-workspace",
    async (forcedRequest) => Response.json(await forcedRequest.json())
  );

  assert.deepEqual(await response.json(), { tenant: "trusted-workspace", lang: "vi" });
});

test("public docs expose the authenticated AI voice API", async () => {
  const docsSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/docs.js", import.meta.url), "utf8"));
  assert.match(docsSource, /\/api\/v1\/ai-voice\/greeting/);
  assert.match(docsSource, /\/api\/v1\/ai-voice\/turn/);
  assert.match(docsSource, /STT.*AI workspace.*TTS/s);
});
