import { validateBlogDraft } from "../content-writing/blogDraft.js";

export const TRANSLATION_LANGUAGE_NAMES = { en: "English", vi: "Vietnamese", ja: "Japanese", es: "Spanish", fr: "French", ko: "Korean", zh: "Chinese" };

export function parseSiteLanguages(site) {
  const source = site.default_language || "en";
  let configured = [];
  try { configured = JSON.parse(site.translation_languages_json || "[]"); } catch { throw new Error("Site translation_languages_json must be a JSON array."); }
  if (!Array.isArray(configured) || configured.some((value) => typeof value !== "string")) throw new Error("Site translation_languages_json must be a JSON array of language codes.");
  const targets = [...new Set(configured.map((value) => value.trim()).filter((value) => value && value !== source))];
  const unsupported = [source, ...targets].filter((value) => !TRANSLATION_LANGUAGE_NAMES[value]);
  if (unsupported.length) throw new Error(`Unsupported site language: ${[...new Set(unsupported)].join(", ")}.`);
  return { source, targets };
}

export function collectBlogSegments(document) {
  const segments = [document.draft.title, document.draft.metaDescription];
  for (const section of document.draft.sections) segments.push(section.heading, ...section.paragraphs, section.imageAlt);
  for (const reference of document.draft.wikipediaReferences) segments.push(reference.term);
  for (const related of document.relatedPosts || []) segments.push(related.title);
  return segments;
}

export function applyBlogSegments(document, translations) {
  let at = 0;
  const take = () => translations[at++];
  const draft = {
    title: take(), metaDescription: take(),
    sections: document.draft.sections.map((section) => ({
      heading: take(), paragraphs: section.paragraphs.map(() => take()), imageAlt: take(),
    })),
    wikipediaReferences: document.draft.wikipediaReferences.map((reference) => ({ term: take(), wikipediaTitle: reference.wikipediaTitle })),
  };
  const relatedPosts = (document.relatedPosts || []).map((post) => ({ ...post, title: take() }));
  if (at !== translations.length) throw new Error("Translation output count does not match the blog document.");
  return { ...document, draft: validateBlogDraft(draft), relatedPosts };
}
