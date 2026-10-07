import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../../../dash-tabler/", import.meta.url);
const VI = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;

async function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(await readFile(new URL("_shared/i18n-content.js", root), "utf8"), context);
  vm.runInContext(await readFile(new URL("_shared/i18n-extra.js", root), "utf8"), context);
  const merged = {};
  for (const lang of ["en", "ja", "es", "fr", "ko"]) merged[lang] = { ...context.window.I18N_CONTENT[lang], ...context.window.I18N_EXTRA[lang] };
  return merged;
}

const html = await readFile(new URL("config.html", root), "utf8");
const start = html.indexOf("Ads Agent (Meta Ads)");
const cardHtml = html.slice(html.lastIndexOf('<div class="card">', start), html.indexOf('<div class="card">', start));

function cardTexts() {
  const texts = [...cardHtml.matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/\s+/g, " ").trim());
  const attrs = [...cardHtml.matchAll(/placeholder="([^"]+)"/g)].map((m) => m[1]);
  return [...texts, ...attrs].filter((t) => t && VI.test(t));
}

test("ads card: mọi chuỗi tiếng Việt trong HTML đều có bản dịch ở cả 5 ngôn ngữ", async () => {
  const catalog = await loadCatalog();
  const texts = cardTexts();
  assert.ok(texts.length >= 10, "phải tìm thấy các chuỗi của card");
  for (const lang of Object.keys(catalog)) {
    for (const text of texts) assert.ok(catalog[lang][text], `${lang} thiếu bản dịch: ${text}`);
  }
});

test("ads card: chuỗi do JavaScript tạo ra cũng có bản dịch", async () => {
  const catalog = await loadCatalog();
  const script = html.slice(html.indexOf("// ===== ADS AGENT"), html.indexOf("async function runAgentNow"));
  const literals = [...script.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")).filter((t) => VI.test(t) && !t.includes("${"));
  assert.ok(literals.length >= 15);
  const skip = new Set(["vi-VN"]);
  for (const lang of Object.keys(catalog)) {
    for (const text of literals) {
      if (skip.has(text)) continue;
      const trimmed = text.trim();
      const prefixHit = Object.keys(catalog[lang]).some((k) => k.endsWith(":") && trimmed.startsWith(k));
      assert.ok(catalog[lang][trimmed] || prefixHit, `${lang} thiếu bản dịch: ${trimmed}`);
    }
  }
});

test("ads card: bản dịch không làm mất tên riêng và không để trống", async () => {
  const catalog = await loadCatalog();
  for (const lang of Object.keys(catalog)) {
    assert.match(catalog[lang]["Token chỉ được lưu dạng mã hóa và không hiển thị lại. Toàn bộ ad account mà token truy cập được sẽ được theo dõi."], /\S{5,}/);
    assert.match(catalog[lang]["Dán token Meta Ads (ads_read)"], /ads_read/);
    assert.match(catalog[lang]["Bấm Generate new token, chọn app của bạn, tick quyền ads_read, chọn thời hạn \"Never\"."], /ads_read/);
  }
});
