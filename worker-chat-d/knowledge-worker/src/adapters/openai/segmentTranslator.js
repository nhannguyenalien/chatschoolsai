import { TRANSLATION_LANGUAGE_NAMES } from "../../domain/translations/blogTranslation.js";

const SCHEMA = { type: "object", properties: { translations: { type: "array", items: { type: "string" } } }, required: ["translations"], additionalProperties: false };

export function createOpenAiSegmentTranslator({ baseUrl, apiKey, model, fetchImpl = fetch }) {
  if (!baseUrl || !apiKey || !model) throw new Error("Translator requires an OpenAI-compatible baseUrl, apiKey and model.");
  return {
    async translate(segments, targetLanguage) {
      if (!segments.length) return [];
      const language = TRANSLATION_LANGUAGE_NAMES[targetLanguage] || targetLanguage;
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: Math.min(1000 + segments.length * 120, 8000), temperature: 0.3,
          messages: [
            { role: "system", content: `Translate every input string into ${language}. Return exactly ${segments.length} strings in the same order. Preserve code, text inside backticks, function names, URLs and technical terms where appropriate.` },
            { role: "user", content: JSON.stringify(segments) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "lesson_translation", strict: true, schema: SCHEMA } },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`Translation failed (HTTP ${response.status}).`);
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("AI returned no translation content.");
      const translations = JSON.parse(raw).translations;
      if (!Array.isArray(translations) || translations.length !== segments.length || translations.some((value) => typeof value !== "string")) throw new Error(`Translation returned ${translations?.length ?? 0} strings; expected ${segments.length}.`);
      return translations;
    },
  };
}
