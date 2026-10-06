import test from "node:test";
import assert from "node:assert/strict";
import { getPageContentMode, shouldTranslateForPage, translatePostForPage, splitPagesByContentMode, buildScheduleCandidateFilter } from "../src/domain/publishing/pageContent.js";

const fb = (extra, lang = "ja") => ({ platform: "facebook", page_id: "p1", default_language: lang, extra_config: JSON.stringify(extra) });

test("page content mode defaults to same and ignores non-social platforms", () => {
  assert.equal(getPageContentMode({ platform: "facebook" }), "same");
  assert.equal(getPageContentMode({ platform: "facebook", extra_config: "not json" }), "same");
  assert.equal(getPageContentMode(fb({ content_mode: "translate" })), "translate");
  assert.equal(getPageContentMode({ platform: "wordpress", extra_config: '{"content_mode":"translate"}' }), "same");
});

test("translates only when mode, language and post language require it", () => {
  const page = fb({ content_mode: "translate" });
  assert.equal(shouldTranslateForPage(page, { language: "vi" }), true);
  assert.equal(shouldTranslateForPage(page, { language: "" }), true);
  assert.equal(shouldTranslateForPage(page, { language: "ja" }), false);
  assert.equal(shouldTranslateForPage(page, { language: "vi", content_plan_item_id: "x" }), false);
  assert.equal(shouldTranslateForPage(fb({}), { language: "vi" }), false);
  assert.equal(shouldTranslateForPage(fb({ content_mode: "translate" }, ""), { language: "vi" }), false);
});

test("translatePostForPage translates title and content into the page language", async () => {
  const calls = [];
  const translator = { async translate(segments, lang) { calls.push(lang); return segments.map((s) => `${lang}:${s}`); } };
  const out = await translatePostForPage({ post: { id: "1", title: "T", content: "C", language: "vi" }, page: fb({ content_mode: "translate" }), translator });
  assert.deepEqual(out, { id: "1", title: "ja:T", content: "ja:C", language: "ja" });
  assert.deepEqual(calls, ["ja"]);
  await assert.rejects(() => translatePostForPage({ post: {}, page: fb({}), translator: null }));
});

test("splits pages into shared and independent groups", () => {
  const a = fb({}), b = fb({ content_mode: "translate" }), c = fb({ content_mode: "independent" });
  const { shared, independent } = splitPagesByContentMode([a, b, c]);
  assert.deepEqual(shared, [a, b]); assert.deepEqual(independent, [c]);
});

test("schedule candidate filter scopes page rules and keeps generic rules off claimed pages", () => {
  const rules = [{ page_id: "p1", content_type: "social" }, { page_id: "", content_type: "social" }];
  const base = { tenant: "t", platformExpr: "platform='facebook'", rules };
  assert.match(buildScheduleCandidateFilter({ ...base, rule: rules[0] }), /page_id='p1'$/);
  assert.match(buildScheduleCandidateFilter({ ...base, rule: rules[1] }), /page_id!='p1'$/);
  assert.doesNotMatch(buildScheduleCandidateFilter({ ...base, rules: [], rule: rules[1] }), /page_id/);
});
