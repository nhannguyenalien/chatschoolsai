function normalizeSiteUrl(value) {
  const url = new URL(String(value || "").trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error("WordPress URL must use http or https.");
  return url.origin + url.pathname.replace(/\/$/, "");
}

export function parseWordPressCredentials(value) {
  const raw = String(value || "");
  const separator = raw.indexOf(":");
  if (separator <= 0 || separator === raw.length - 1) throw new Error('WordPress credentials must use "username:application_password".');
  return { username: raw.slice(0, separator).trim(), applicationPassword: raw.slice(separator + 1).trim() };
}

export async function testWordPressConnection(page, fetchImpl = fetch) {
  if (page?.platform !== "wordpress") throw new Error("Selected channel is not WordPress.");
  const site = normalizeSiteUrl(page.page_id);
  const { username, applicationPassword } = parseWordPressCredentials(page.access_token);
  const authorization = `Basic ${btoa(`${username}:${applicationPassword}`)}`;
  const response = await fetchImpl(`${site}/wp-json/wp/v2/users/me?context=edit`, { headers: { Authorization: authorization, Accept: "application/json" }, timeout: 15_000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `WordPress API HTTP ${response.status}`);
  return { connected: true, site, user: { id: body.id, name: body.name || body.slug || username }, canPublishPosts: Boolean(body.capabilities?.publish_posts) };
}
