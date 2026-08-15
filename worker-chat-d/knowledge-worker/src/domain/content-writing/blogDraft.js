export const AI_AUTHOR_NAME = "Đội Ngũ Toidayhoc";

const LANGUAGE_NAMES = { en: "English", vi: "Vietnamese", ja: "Japanese", es: "Spanish", fr: "French", ko: "Korean", zh: "Chinese" };

const SECTION_LABELS = {
  en: { related: "Related Articles", references: "Further Reading" },
  vi: { related: "Bài viết liên quan", references: "Tài liệu tham khảo" },
  ja: { related: "関連記事", references: "参考資料" },
  es: { related: "Artículos relacionados", references: "Lecturas adicionales" },
  fr: { related: "Articles connexes", references: "Pour aller plus loin" },
  ko: { related: "관련 글", references: "추가 자료" },
  zh: { related: "相关文章", references: "延伸阅读" },
};

export function buildBlogSystemPrompt(language = "en") {
  const languageName = LANGUAGE_NAMES[language] || "English";
  return `Bạn là content writer kiêm chuyên gia SEO, viết blog hướng dẫn/chia sẻ kiến thức cho một trung tâm dạy lập trình/marketing thực chiến.
Nguyên tắc bắt buộc:
- "title" ngắn gọn, hấp dẫn, KHÔNG quá 60 ký tự (quan trọng cho SEO — bị cắt bớt nếu dài hơn).
- "metaDescription" dài 50-160 ký tự, tóm tắt hấp dẫn nội dung bài viết, dùng để hiển thị trên kết quả tìm kiếm Google.
- "sections" gồm 6-8 phần, mỗi phần có:
  + "heading" (tiêu đề phụ ngắn gọn, dạng H2, chứa từ khóa liên quan chủ đề).
  + "paragraphs" (2-3 đoạn văn, mỗi đoạn 3-6 câu, có ví dụ/số liệu thực tế cụ thể — không sáo rỗng).
  + "imageAlt" — 1 câu mô tả NGẮN GỌN, CỤ THỂ nội dung 1 ảnh minh họa trừu tượng (dạng icon/sơ đồ/biểu tượng đơn giản) phù hợp với phần này, ví dụ "A simple diagram showing data flowing between two connected app icons" — mô tả này vừa dùng để vẽ ảnh vừa dùng làm alt text thật cho ảnh (bắt buộc phải mô tả đúng nội dung ảnh, không chung chung).
  Tổng nội dung khoảng 1200-1600 từ — đủ sâu, đủ chi tiết để xếp hạng tốt trên Google, không lan man.
- "wikipediaReferences": chọn 2-3 THUẬT NGỮ/KHÁI NIỆM quan trọng nhất được nhắc tới trong bài (vd tên công nghệ, khái niệm chuyên ngành phổ biến, có khả năng cao đã có trang Wikipedia tiếng Anh) — với mỗi thuật ngữ, "term" là cách gọi tự nhiên trong bài, "wikipediaTitle" là tên trang Wikipedia tiếng Anh chuẩn của thuật ngữ đó (dùng định dạng tiêu đề Wikipedia thật, vd "Prompt engineering", "Application programming interface"). CHỈ chọn thuật ngữ phổ biến, có thật, không bịa.
- Văn phong: hữu ích, thực tế, có ví dụ cụ thể — tránh sáo rỗng, tránh liệt kê số liệu/thống kê bịa đặt (trừ các thuật ngữ Wikipedia phổ biến thật).
- KHÔNG dùng markdown (không **, không danh sách -, không #) — chỉ văn xuôi thuần trong "paragraphs".
- TOÀN BỘ nội dung (title, metaDescription, heading, paragraphs, imageAlt) PHẢI viết bằng ${languageName}, kể cả khi chủ đề đưa vào ở ngôn ngữ khác. Riêng "wikipediaTitle" luôn để tiếng Anh (khớp tên trang Wikipedia thật).`;
}

export const BLOG_DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    metaDescription: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          imageAlt: { type: "string" },
        },
        required: ["heading", "paragraphs", "imageAlt"], additionalProperties: false,
      },
    },
    wikipediaReferences: {
      type: "array",
      items: {
        type: "object",
        properties: { term: { type: "string" }, wikipediaTitle: { type: "string" } },
        required: ["term", "wikipediaTitle"], additionalProperties: false,
      },
    },
  },
  required: ["title", "metaDescription", "sections", "wikipediaReferences"], additionalProperties: false,
};

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`AI blog draft field '${field}' must be non-empty text.`);
  return value.trim();
}

export function validateBlogDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI blog draft must be an object.");
  if (!Array.isArray(value.sections) || !Array.isArray(value.wikipediaReferences)) throw new Error("AI blog draft arrays are invalid.");
  return {
    title: requiredText(value.title, "title"),
    metaDescription: requiredText(value.metaDescription, "metaDescription"),
    sections: value.sections.map((section, index) => ({
      heading: requiredText(section?.heading, `sections[${index}].heading`),
      paragraphs: Array.isArray(section?.paragraphs)
        ? section.paragraphs.map((paragraph, p) => requiredText(paragraph, `sections[${index}].paragraphs[${p}]`))
        : (() => { throw new Error(`AI blog draft field 'sections[${index}].paragraphs' must be an array.`); })(),
      imageAlt: requiredText(section?.imageAlt, `sections[${index}].imageAlt`),
    })),
    wikipediaReferences: value.wikipediaReferences.map((reference, index) => ({
      term: requiredText(reference?.term, `wikipediaReferences[${index}].term`),
      wikipediaTitle: requiredText(reference?.wikipediaTitle, `wikipediaReferences[${index}].wikipediaTitle`),
    })),
  };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function wikipediaUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`;
}

export function renderBlogHtml(draft, { language = "en", relatedPosts = [], sectionImages = [] } = {}) {
  const parts = [];
  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;
  draft.sections.forEach((section, index) => {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    if (sectionImages[index]?.url) parts.push(`<img src="${escapeHtml(sectionImages[index].url)}" alt="${escapeHtml(section.imageAlt)}">`);
    section.paragraphs.forEach((paragraph) => parts.push(`<p>${escapeHtml(paragraph)}</p>`));
  });
  if (relatedPosts.length) {
    parts.push(`<h2>${labels.related}</h2>`);
    relatedPosts.forEach((post) => parts.push(`<p><a href="/blog-details/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></p>`));
  }
  if (draft.wikipediaReferences.length) {
    parts.push(`<h2>${labels.references}</h2>`);
    draft.wikipediaReferences.forEach((ref) => parts.push(`<p><a href="${wikipediaUrl(ref.wikipediaTitle)}">${escapeHtml(ref.term)}</a></p>`));
  }
  return parts.join("\n");
}

export function serializeBlogDocument(draft, { relatedPosts = [], sectionImages = [] } = {}) {
  return JSON.stringify({ version: 1, draft, relatedPosts, sectionImages });
}

export function parseBlogDocument(value) {
  const document = typeof value === "string" ? JSON.parse(value) : value;
  if (!document || document.version !== 1) throw new Error("Unsupported structured blog document.");
  return { ...document, draft: validateBlogDraft(document.draft), relatedPosts: document.relatedPosts || [], sectionImages: document.sectionImages || [] };
}

export function slugifyBlogTitle(title, random = Math.random) {
  const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${random().toString(36).slice(2, 6)}`;
}
