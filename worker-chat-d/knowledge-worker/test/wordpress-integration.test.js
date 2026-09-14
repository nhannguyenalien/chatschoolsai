import test from "node:test";
import assert from "node:assert/strict";
import { parseWordPressCredentials, testWordPressConnection as checkConnection } from "../src/integrations/wordpress.js";

test("parses WordPress application password credentials", () => {
  assert.deepEqual(parseWordPressCredentials("editor:abcd efgh ijkl"), { username: "editor", applicationPassword: "abcd efgh ijkl" });
  assert.throws(() => parseWordPressCredentials("missing-password"), /username:application_password/);
});

test("checks the authenticated WordPress user and publish permission", async () => {
  let request;
  const result = await checkConnection({ platform: "wordpress", page_id: "https://example.com/", access_token: "editor:app pass" }, async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: 7, name: "Editor", capabilities: { publish_posts: true } }), { status: 200 });
  });
  assert.equal(request.url, "https://example.com/wp-json/wp/v2/users/me?context=edit");
  assert.match(request.init.headers.Authorization, /^Basic /);
  assert.deepEqual(result, { connected: true, site: "https://example.com", user: { id: 7, name: "Editor" }, canPublishPosts: true });
});

test("surfaces WordPress API authentication errors", async () => {
  await assert.rejects(() => checkConnection({ platform: "wordpress", page_id: "https://example.com", access_token: "editor:bad" }, async () => new Response(JSON.stringify({ message: "Invalid application password" }), { status: 401 })), /Invalid application password/);
});
