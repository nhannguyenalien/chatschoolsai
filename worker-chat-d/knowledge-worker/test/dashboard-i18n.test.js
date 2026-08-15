import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const dashboardRoot = new URL("../../../dash-tabler/", import.meta.url);

test("deep dashboard sections load the current shared translation runtime", async () => {
  const pages = [
    "index.html", "config.html", "agent-chat.html", "knowledge.html", "messages.html",
    "billing.html", "post.html", "composer.html", "analytics.html", "sm-config.html", "loyalty.html",
  ];
  for (const page of pages) {
    const html = await readFile(new URL(page, dashboardRoot), "utf8");
    assert.match(html, /_shared\/i18n\.js\?v=20260814-1/, `${page} must load the current i18n runtime`);
  }
});

test("deep Chatbot, Training, Messages, schedule and planning strings exist in every language", async () => {
  const source = await readFile(new URL("_shared/i18n-content.js", dashboardRoot), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);

  const required = [
    "Thông tin chi tiết", "Tài liệu đã nhận", "Chưa có tài liệu nào",
    "Chỉnh sửa tài liệu", "Lưu & Embedding", "Lịch đăng bài",
    "Thêm ít nhất 1 giờ đăng", "Nhập trend & tư vấn topic", "Topic chờ duyệt",
    "Bản nháp chờ duyệt", "Bài đăng thành công theo ngày",
  ];
  for (const lang of ["en", "ja", "es", "fr", "ko"]) {
    assert.equal(Object.keys(context.window.I18N_CONTENT[lang]).length, 523, `${lang} must translate the full catalog`);
    for (const value of required) {
      assert.ok(context.window.I18N_CONTENT[lang]?.[value], `${lang} is missing: ${value}`);
    }
  }
});

test("navigation terms use context-appropriate translations", async () => {
  const source = await readFile(new URL("_shared/i18n-content.js", dashboardRoot), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);

  const expected = {
    en: { "Bạn": "You", "Nền tảng": "Platform", "Soạn Bài": "Composer" },
    ja: { "Bạn": "あなた", "Nền tảng": "プラットフォーム", "Soạn Bài": "投稿作成" },
    es: { "Bạn": "Tú", "Nền tảng": "Plataforma", "Soạn Bài": "Redactor" },
    fr: { "Bạn": "Vous", "Nền tảng": "Plateforme", "Soạn Bài": "Rédacteur" },
    ko: { "Bạn": "사용자", "Nền tảng": "플랫폼", "Soạn Bài": "게시물 작성" },
  };
  for (const [language, translations] of Object.entries(expected)) {
    for (const [sourceText, translatedText] of Object.entries(translations)) {
      assert.equal(context.window.I18N_CONTENT[language][sourceText], translatedText);
    }
  }
});

test("shared i18n refreshes reused dynamic nodes and variable counters", async () => {
  const source = await readFile(new URL("_shared/i18n.js", dashboardRoot), "utf8");
  assert.match(source, /node\.nodeValue !== previousRendered/);
  assert.match(source, /source\.match\(\/\^\(\\d\+\)\\s\+/);
  assert.match(source, /characterData: true/);
  assert.match(source, /i18n-content\.js\?v=20260814-1/);
});
