// Public link of a published post, stored on post_targets.published_url so it can be opened from the
// dashboard or quoted by the agent. Never throws: a missing link must not turn a published post into an error.
const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
};

// Link derivable from the stored platform id alone (no network, no token).
export function fallbackPublishedUrl(platform, publishedId) {
  const id = String(publishedId || "").trim();
  if (!id) return "";
  if (/^https?:\/\//i.test(id)) return safeUrl(id); // WordPress already stores the post link
  if (platform === "facebook" && /^[\w-]+$/.test(id)) return `https://www.facebook.com/${id}`;
  if (platform === "youtube" && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube.com/watch?v=${id}`;
  return "";
}

// Sanity has no fixed public URL: the page may define extra_config.postUrlTemplate, e.g. "https://site.com/blog/{slug}".
function sanityUrl(page, post, publishedId) {
  let template = "";
  try { template = String(JSON.parse(page?.extra_config || "{}").postUrlTemplate || ""); } catch { /* no template */ }
  if (!template || !(post?.slug || publishedId)) return "";
  return safeUrl(template.replace("{slug}", encodeURIComponent(post?.slug || "")).replace("{id}", encodeURIComponent(publishedId)));
}

export async function resolvePublishedUrl({ platform, publishedId, page, post, fetchImpl, graphBase }) {
  const id = String(publishedId || "").trim();
  if (!id) return "";
  const fallback = fallbackPublishedUrl(platform, id);
  try {
    if ((platform === "facebook" || platform === "instagram") && page?.access_token && graphBase) {
      const field = platform === "facebook" ? "permalink_url" : "permalink";
      const res = await fetchImpl(`${graphBase}/${encodeURIComponent(id)}?fields=${field}`, {
        headers: { Authorization: `Bearer ${page.access_token}` }
      });
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      return safeUrl(data[field]) || fallback;
    }
    if (platform === "wordpress" && !fallback && /^\d+$/.test(id) && page?.page_id && page?.access_token) {
      const [user, password] = String(page.access_token).split(":");
      const site = String(page.page_id).replace(/\/+$/, "");
      const res = await fetchImpl(`${site}/wp-json/wp/v2/posts/${id}`, { headers: { Authorization: `Basic ${btoa(`${user}:${password}`)}` } });
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      return safeUrl(data.link);
    }
    if (platform === "sanity") return sanityUrl(page, post, id);
  } catch {
    /* fall through to the id-derived link */
  }
  return fallback;
}
