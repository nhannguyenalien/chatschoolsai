// Generic Sanity publisher for posts written as HTML (the dashboard blog editor and the AI writers).
// It targets the standard blog schema (post: title, slug, excerpt, mainImage, body, language, publishedAt,
// seoTitle, seoDescription) and is idempotent: the document id derives from the PocketBase post id, so
// editing a post and publishing again updates the same Sanity document instead of creating a duplicate.
import { parseSanityExtraConfig } from "./blogPublisher.js";

const API_VERSION = "v2021-06-07";
const SAFE_PROJECT_ID = /^[a-z0-9-]+$/;
const SAFE_DATASET = /^[A-Za-z0-9_-]+$/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (text) => String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
  if (code[0] === "#") {
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    try { return String.fromCodePoint(point); } catch { return match; }
  }
  return ENTITIES[code.toLowerCase()] ?? match;
});

const DECORATORS = { strong: "strong", b: "strong", em: "em", i: "em", code: "code" };
const HEADINGS = { h1: "h2", h2: "h2", h3: "h3", h4: "h4" };
const attr = (attrs, name) => {
  const m = String(attrs).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? decodeEntities(m[1] ?? m[2]) : "";
};
const safeHref = (href) => (/^(https?:\/\/|mailto:|\/|#)/i.test(href.trim()) ? href.trim() : "");

// Portable Text from the HTML subset the editor/AI produce: headings, paragraphs, bullet/numbered lists,
// blockquotes, images, and bold/italic/code/link marks. Unknown tags are ignored but their text is kept.
export function htmlToPortableText(html) {
  const blocks = [];
  let seq = 0;
  const key = () => `k${(seq++).toString(36)}`;
  let current = null;
  const marks = [];
  const lists = [];
  const links = [];
  let quoteDepth = 0;

  const flush = () => {
    if (!current) return;
    const { children } = current;
    if (children.length) {
      children[0].text = children[0].text.replace(/^\s+/, "");
      children[children.length - 1].text = children[children.length - 1].text.replace(/\s+$/, "");
    }
    const merged = [];
    for (const span of children) {
      if (!span.text) continue;
      const last = merged[merged.length - 1];
      if (last && last.marks.join() === span.marks.join()) last.text += span.text;
      else merged.push(span);
    }
    if (merged.some((s) => s.text.trim())) {
      const { style, listItem, level, markDefs } = current;
      const block = { _type: "block", _key: key(), style, children: merged, markDefs: markDefs.filter((d) => merged.some((s) => s.marks.includes(d._key))) };
      if (listItem) { block.listItem = listItem; block.level = level; }
      blocks.push(block);
    }
    current = null;
  };
  const open = (style, extra = {}) => {
    flush();
    current = { style, children: [], markDefs: [], ...extra };
  };
  const ensureBlock = () => {
    if (current) return;
    const list = lists[lists.length - 1];
    if (list) open("normal", { listItem: list, level: lists.length });
    else open(quoteDepth ? "blockquote" : "normal");
  };
  const addText = (raw) => {
    const text = decodeEntities(raw).replace(/\s+/g, " ");
    if (!text.trim() && !current) return;
    ensureBlock();
    const last = current.children[current.children.length - 1];
    if (!current.children.length && !text.trim()) return;
    if (last && last.marks.join() === marks.join()) last.text += text;
    else current.children.push({ _type: "span", _key: key(), text, marks: [...marks] });
  };

  const tokens = String(html || "").matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g);
  for (const m of tokens) {
    if (m[4] !== undefined) { addText(m[4]); continue; }
    if (!m[2]) { if (m[0] === "<") addText("<"); continue; }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] || "";
    if (HEADINGS[tag]) { closing ? flush() : open(HEADINGS[tag]); }
    else if (tag === "p") { closing ? flush() : (flush(), open(quoteDepth ? "blockquote" : "normal", lists.length ? { listItem: lists[lists.length - 1], level: lists.length } : {})); }
    else if (tag === "ul" || tag === "ol") {
      flush();
      if (closing) lists.pop(); else lists.push(tag === "ol" ? "number" : "bullet");
    }
    else if (tag === "li") { closing ? flush() : open("normal", { listItem: lists[lists.length - 1] || "bullet", level: Math.max(lists.length, 1) }); }
    else if (tag === "blockquote") { flush(); quoteDepth = Math.max(0, quoteDepth + (closing ? -1 : 1)); }
    else if (tag === "br") { if (!closing && current) addText("\n"); }
    else if (tag === "img" && !closing) {
      flush();
      const url = attr(attrs, "src");
      if (/^https?:\/\//i.test(url)) blocks.push({ _type: "image", _key: key(), _url: url, alt: attr(attrs, "alt") });
    }
    else if (DECORATORS[tag]) {
      if (closing) { const at = marks.lastIndexOf(DECORATORS[tag]); if (at >= 0) marks.splice(at, 1); }
      else marks.push(DECORATORS[tag]);
    }
    else if (tag === "a") {
      if (closing) {
        const markKey = links.pop();
        const at = markKey ? marks.lastIndexOf(markKey) : -1;
        if (at >= 0) marks.splice(at, 1);
      } else {
        const href = safeHref(attr(attrs, "href"));
        if (href) {
          ensureBlock();
          const markKey = key();
          current.markDefs.push({ _type: "link", _key: markKey, href });
          marks.push(markKey);
          links.push(markKey);
        } else {
          links.push(null);
        }
      }
    }
  }
  flush();
  return blocks;
}

export function slugify(text) {
  return String(text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function sanityPostDocumentId(postId) {
  const safe = String(postId || "").replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) throw new Error("A post id is required for deterministic Sanity publishing.");
  return `dashpoc-post-${safe}`;
}

function plainText(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseTarget(page) {
  const [projectId, dataset, ...rest] = String(page?.page_id || "").split(":");
  if (!projectId || !dataset || rest.length || !SAFE_PROJECT_ID.test(projectId) || !SAFE_DATASET.test(dataset)) {
    throw new Error('page_id Sanity phải theo dạng "projectId:dataset"');
  }
  if (!page?.access_token) throw new Error("Thiếu Sanity API token");
  return { projectId, dataset };
}

export function buildSanityPostFields({ post, page, body, mainImage, config, now = new Date() }) {
  const excerptSource = post.meta_description || plainText(post.content);
  const excerpt = excerptSource.length > 300 ? `${excerptSource.slice(0, 297).trimEnd()}...` : excerptSource;
  const slug = post.slug || slugify(post.title);
  const fields = {
    [config.titleField || "title"]: post.title,
    [config.bodyField || "body"]: body,
    [config.excerptField || "excerpt"]: excerpt,
    language: post.language || page?.default_language || "en",
    updatedAt: now.toISOString(),
  };
  if (slug) fields[config.slugField || "slug"] = { _type: "slug", current: slug };
  if (post.meta_title) fields.seoTitle = post.meta_title;
  if (post.meta_description) fields.seoDescription = post.meta_description;
  if (mainImage) fields.mainImage = mainImage;
  return fields;
}

async function readJson(response, context) {
  try { return await response.json(); }
  catch { throw new Error(`${context} returned invalid JSON (HTTP ${response.status}).`); }
}

export function createSanityHtmlPublisher({ fetchImpl = fetch, apiVersion = API_VERSION, now = () => new Date() } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Sanity publisher requires fetch.");
  return async function publishSanityHtml(page, post, media) {
    const { projectId, dataset } = parseTarget(page);
    const config = parseSanityExtraConfig(page.extra_config);
    const baseUrl = `https://${projectId}.api.sanity.io/${apiVersion}`;
    const headers = { Authorization: `Bearer ${page.access_token}` };

    const uploadImage = async (url) => {
      const image = await fetchImpl(url);
      if (!image.ok) throw new Error(`Không tải được ảnh (HTTP ${image.status})`);
      const asset = await fetchImpl(`${baseUrl}/assets/images/${dataset}`, {
        method: "POST", headers: { ...headers, "Content-Type": image.headers.get("content-type") || "image/png" },
        body: await image.arrayBuffer(),
      });
      const payload = await readJson(asset, "Sanity image upload");
      if (!asset.ok || !payload.document?._id) throw new Error(payload.error?.description || payload.message || `HTTP ${asset.status}`);
      return { _type: "image", asset: { _type: "reference", _ref: payload.document._id } };
    };
    // A broken image must not block the article: log and publish without it.
    const tryUpload = async (url) => {
      try { return await uploadImage(url); }
      catch (error) { console.error("[Sanity] Bỏ qua ảnh lỗi:", url, error.message); return null; }
    };

    const body = [];
    for (const block of htmlToPortableText(post.content)) {
      if (block._type !== "image") { body.push(block); continue; }
      const image = await tryUpload(block._url);
      if (image) body.push({ ...image, _key: block._key, alt: block.alt });
    }
    if (!body.length) throw new Error("Bài viết chưa có nội dung để đăng lên Sanity");
    const mainImage = media?.url ? await tryUpload(media.url) : null;
    if (mainImage && post.alt_img) mainImage.alt = post.alt_img;

    const timestamp = now();
    const _id = sanityPostDocumentId(post.id);
    const docType = config.docType || "post";
    const fields = buildSanityPostFields({ post, page, body, mainImage, config, now: timestamp });
    // createIfNotExists seeds publishedAt once; patch.set updates everything else, so the original publish date survives edits.
    const mutations = [
      { createIfNotExists: { _id, _type: docType, publishedAt: timestamp.toISOString() } },
      { patch: { id: _id, set: fields } },
    ];
    const response = await fetchImpl(`${baseUrl}/data/mutate/${dataset}?returnIds=true`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ mutations }),
    });
    const payload = await readJson(response, "Sanity mutation");
    if (!response.ok) throw new Error(`Sanity publish failed: ${payload.error?.description || payload.message || `HTTP ${response.status}`}`);
    return _id;
  };
}
