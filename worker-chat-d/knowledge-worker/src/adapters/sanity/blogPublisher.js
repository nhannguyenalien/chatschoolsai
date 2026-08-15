import { parseBlogDocument } from "../../domain/content-writing/blogDraft.js";

const API_VERSION = "v2021-06-07";
const SAFE_PROJECT_ID = /^[a-z0-9-]+$/;
const SAFE_DATASET = /^[A-Za-z0-9_-]+$/;
const SAFE_DOCUMENT_PART = /[^A-Za-z0-9_-]/g;

export const SKILLGO_BLOG_PROFILE = "skillgo-blog-v1";

const SECTION_LABELS = {
  en: { related: "Related Articles", references: "Further Reading" },
  vi: { related: "Bài viết liên quan", references: "Tài liệu tham khảo" },
  ja: { related: "関連記事", references: "参考資料" },
  es: { related: "Artículos relacionados", references: "Lecturas adicionales" },
  fr: { related: "Articles connexes", references: "Pour aller plus loin" },
  ko: { related: "관련 글", references: "추가 자료" },
};

export class SanityBlogConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SanityBlogConfigurationError";
  }
}

export function parseSanityExtraConfig(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new SanityBlogConfigurationError("Sanity extra_config must contain valid JSON.");
  }
}

export function isSkillgoBlogProfile(page) {
  return parseSanityExtraConfig(page?.extra_config).contentPlanningProfile === SKILLGO_BLOG_PROFILE;
}

function parseTarget(page) {
  const [projectId, dataset, ...rest] = String(page?.page_id || "").split(":");
  if (!projectId || !dataset || rest.length || !SAFE_PROJECT_ID.test(projectId) || !SAFE_DATASET.test(dataset)) {
    throw new SanityBlogConfigurationError('Sanity page_id must use the safe "projectId:dataset" format.');
  }
  if (!page?.access_token) throw new SanityBlogConfigurationError("Sanity API token is required.");
  return { projectId, dataset };
}

export function sanityBlogDocumentId(postId) {
  const safeId = String(postId || "").replace(SAFE_DOCUMENT_PART, "-").replace(/^-+|-+$/g, "");
  if (!safeId) throw new Error("A PocketBase post id is required for deterministic Sanity publishing.");
  return `dashpoc-blog-${safeId}`;
}

function span(text, key, marks = []) {
  return { _type: "span", _key: key, text: String(text), marks };
}

function textBlock(text, style, key, link) {
  const markKey = `${key}-link`;
  return {
    _type: "block", _key: key, style,
    children: [span(text, `${key}-span`, link ? [markKey] : [])],
    markDefs: link ? [{ _type: "link", _key: markKey, href: link }] : [],
  };
}

function wikipediaUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).trim().replace(/ /g, "_"))}`;
}

export function buildSkillgoPortableText(document, sectionAssetRefs = []) {
  const blocks = [];
  const language = document.language || "en";
  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;
  document.draft.sections.forEach((section, sectionIndex) => {
    blocks.push(textBlock(section.heading, "h2", `section-${sectionIndex}-heading`));
    const assetRef = sectionAssetRefs[sectionIndex];
    if (assetRef) {
      blocks.push({
        _type: "image", _key: `section-${sectionIndex}-image`, alt: section.imageAlt,
        asset: { _type: "reference", _ref: assetRef },
      });
    }
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      blocks.push(textBlock(paragraph, "normal", `section-${sectionIndex}-paragraph-${paragraphIndex}`));
    });
  });
  if (document.relatedPosts.length) {
    blocks.push(textBlock(labels.related, "h2", "related-heading"));
    document.relatedPosts.forEach((related, index) => {
      blocks.push(textBlock(related.title, "normal", `related-${index}`, `/blog-details/${encodeURIComponent(related.slug)}`));
    });
  }
  if (document.draft.wikipediaReferences.length) {
    blocks.push(textBlock(labels.references, "h2", "references-heading"));
    document.draft.wikipediaReferences.forEach((reference, index) => {
      blocks.push(textBlock(reference.term, "normal", `reference-${index}`, wikipediaUrl(reference.wikipediaTitle)));
    });
  }
  return blocks;
}

export function buildSkillgoBlogDocument({ post, structuredDocument, thumbAssetRef, sectionAssetRefs = [] }) {
  const date = String(post.created || new Date().toISOString()).slice(0, 10);
  const document = {
    _id: sanityBlogDocumentId(post.id), _type: "blog",
    title: post.title, slug: { _type: "slug", current: post.slug },
    tag: post.tag || "", date,
    author: post.author || "Đội Ngũ Toidayhoc", status: "published", language: post.language || "en",
    metaDescription: post.meta_description || "",
    content: buildSkillgoPortableText({ ...structuredDocument, language: post.language || "en" }, sectionAssetRefs),
  };
  if (!post.translation_of) document.seriesId = post.cluster_id || "";
  if (thumbAssetRef) document.thumb = { _type: "image", alt: post.alt_img || post.title, asset: { _type: "reference", _ref: thumbAssetRef } };
  if (post.translation_of) document.translationOf = { _type: "reference", _ref: sanityBlogDocumentId(post.translation_of) };
  return document;
}

async function responseJson(response, context) {
  try { return await response.json(); }
  catch { throw new Error(`${context} returned invalid JSON (HTTP ${response.status}).`); }
}

export function createSanityBlogPublisher({ fetchImpl = fetch, apiVersion = API_VERSION } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Sanity blog publisher requires fetch.");
  return async function publishSkillgoBlog(page, post, media) {
    const { projectId, dataset } = parseTarget(page);
    const baseUrl = `https://${projectId}.api.sanity.io/${apiVersion}`;
    const headers = { Authorization: `Bearer ${page.access_token}` };
    const structuredDocument = parseBlogDocument(post.content_json);

    const loadSourceAssets = async () => {
      const sourceId = sanityBlogDocumentId(post.translation_of);
      const params = new URLSearchParams({
        query: '*[_type == "blog" && _id == $id][0]{thumb,content[]{_type,style,asset}}',
        "$id": JSON.stringify(sourceId),
      });
      const response = await fetchImpl(`${baseUrl}/data/query/${dataset}?${params}`, { headers });
      const payload = await responseJson(response, "Sanity source blog query");
      if (!response.ok) throw new Error(`Sanity source blog query failed: ${payload.error?.description || payload.message || `HTTP ${response.status}`}`);
      if (!payload.result) throw new Error(`Source Sanity blog '${sourceId}' must be published before its translation.`);
      const sectionAssetRefs = Array(structuredDocument.draft.sections.length).fill(null);
      let sectionIndex = -1;
      for (const block of payload.result.content || []) {
        if (block?._type === "block" && block.style === "h2") sectionIndex += 1;
        else if (block?._type === "image" && sectionIndex >= 0 && sectionIndex < sectionAssetRefs.length) {
          sectionAssetRefs[sectionIndex] = block.asset?._ref || null;
        }
      }
      return { thumbAssetRef: payload.result.thumb?.asset?._ref || null, sectionAssetRefs };
    };

    const uploadImage = async (url, label) => {
      if (!url) return null;
      const imageResponse = await fetchImpl(url);
      if (!imageResponse.ok) throw new Error(`Could not download ${label} (HTTP ${imageResponse.status}).`);
      const assetResponse = await fetchImpl(`${baseUrl}/assets/images/${dataset}`, {
        method: "POST", headers: { ...headers, "Content-Type": imageResponse.headers.get("content-type") || "image/png" },
        body: await imageResponse.arrayBuffer(),
      });
      const payload = await responseJson(assetResponse, `Sanity ${label} upload`);
      if (!assetResponse.ok || !payload.document?._id) {
        throw new Error(`Sanity ${label} upload failed: ${payload.error?.description || payload.message || `HTTP ${assetResponse.status}`}`);
      }
      return payload.document._id;
    };

    const inheritedAssets = post.translation_of ? await loadSourceAssets() : null;
    const thumbAssetRef = inheritedAssets?.thumbAssetRef ?? await uploadImage(media?.url, "thumbnail");
    const sectionAssetRefs = inheritedAssets?.sectionAssetRefs
      ?? await Promise.all(structuredDocument.sectionImages.map((image, index) => uploadImage(image?.url, `section image ${index + 1}`)));
    const document = buildSkillgoBlogDocument({ post, structuredDocument, thumbAssetRef, sectionAssetRefs });
    const mutationResponse = await fetchImpl(`${baseUrl}/data/mutate/${dataset}?returnIds=true`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [{ createOrReplace: document }] }),
    });
    const payload = await responseJson(mutationResponse, "Sanity mutation");
    if (!mutationResponse.ok) throw new Error(`Sanity publish failed: ${payload.error?.description || payload.message || `HTTP ${mutationResponse.status}`}`);
    return document._id;
  };
}
