import { BLOG_DRAFT_JSON_SCHEMA, buildBlogSystemPrompt, validateBlogDraft } from "../../domain/content-writing/blogDraft.js";

function extractJson(raw) {
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("AI response did not contain a JSON object.");
    return JSON.parse(raw.slice(start, end + 1));
  }
}

export function createOpenAiBlogWriter({ baseUrl, apiKey, model, fetchImpl = fetch }) {
  if (!baseUrl || !apiKey || !model) throw new Error("Blog writer requires an OpenAI-compatible baseUrl, apiKey and model.");
  return {
    async generate({ topic, tag, language = "en" }) {
      const example = '{"title": "5 Common Git Mistakes Beginners Make", "metaDescription": "Avoid these 5 common Git mistakes that trip up beginners and learn how to fix them with simple, practical habits.", "sections": [{"heading": "Committing Too Much at Once", "paragraphs": ["Many beginners bundle unrelated changes into a single commit, making it hard to review or revert later.", "Instead, commit small, focused changes with clear messages so your history stays easy to follow."], "imageAlt": "A simple diagram showing several small file icons merging into one labeled commit box"}], "wikipediaReferences": [{"term": "Git", "wikipediaTitle": "Git"}, {"term": "version control", "wikipediaTitle": "Version control"}]}';
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: 4000, temperature: 0.7,
          messages: [
            { role: "system", content: `${buildBlogSystemPrompt(language)}\n\nCHỈ trả lời bằng đúng 1 object JSON theo CHÍNH XÁC mẫu sau (giữ nguyên tên field, không đổi tên, không thêm/bớt field, không thêm chữ nào trước hoặc sau JSON):\n${example}` },
            { role: "user", content: `Chủ đề bài viết: ${topic}\nDanh mục/tag: ${tag}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "daily_blog_content", strict: true, schema: BLOG_DRAFT_JSON_SCHEMA } },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`Blog generation failed (HTTP ${response.status}).`);
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("AI returned no blog content.");
      return validateBlogDraft(extractJson(raw));
    },
  };
}
