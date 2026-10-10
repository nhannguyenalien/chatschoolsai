import assert from "node:assert/strict";
import test from "node:test";

import {
  allowsAi, buildImagePrompt, buildPickMessages, heuristicPick, normalizeImagePolicy,
  parsePickedItem, selectLibraryCandidates, usesLibrary
} from "../src/domain/media/postImagePolicy.js";

test("normalizeImagePolicy giữ hành vi cũ (ai_only) khi tenant chưa cấu hình hoặc giá trị sai", () => {
  assert.deepEqual(normalizeImagePolicy({}), { mode: "ai_only", style: "" });
  assert.equal(normalizeImagePolicy({ image_mode: "bogus" }).mode, "ai_only");
  assert.deepEqual(normalizeImagePolicy({ image_mode: "library_first", image_style: "  flat, blue  " }), { mode: "library_first", style: "flat, blue" });
  assert.equal(normalizeImagePolicy({ image_style: "x".repeat(900) }).style.length, 300);
});

test("mode quyết định có dùng thư viện / AI", () => {
  assert.deepEqual(["ai_only", "library_first", "library_only", "none"].map(usesLibrary), [false, true, true, false]);
  assert.deepEqual(["ai_only", "library_first", "library_only", "none"].map(allowsAi), [true, true, false, false]);
});

test("buildImagePrompt gắn style của tenant, không tạo prompt khi bài không có image_prompt", () => {
  assert.equal(buildImagePrompt("a cozy cafe", "warm tones"), "a cozy cafe. Visual style: warm tones");
  assert.equal(buildImagePrompt("a cozy cafe", ""), "a cozy cafe");
  assert.equal(buildImagePrompt("", "warm tones"), "");
});

test("selectLibraryCandidates bỏ logo/video/chưa sẵn sàng và tránh ảnh vừa dùng, nhưng không bao giờ rỗng nếu còn ảnh", () => {
  const items = [
    { url: "https://x/logo.png", label: "Logo", type: "image", status: "ready" },
    { url: "https://x/a.jpg", label: "A", type: "image", status: "ready" },
    { url: "https://x/b.jpg", label: "B", type: "image", status: "ready" },
    { url: "https://x/v.mp4", label: "V", type: "video", status: "ready" },
    { url: "https://x/c.jpg", label: "C", type: "image", status: "processing" }
  ];
  const urls = (list) => list.map((i) => i.url);
  assert.deepEqual(urls(selectLibraryCandidates(items, { logoUrl: "https://x/logo.png", recentUrls: ["https://x/a.jpg"] })), ["https://x/b.jpg"]);
  assert.deepEqual(urls(selectLibraryCandidates(items, { logoUrl: "https://x/logo.png", recentUrls: ["https://x/a.jpg", "https://x/b.jpg"] })), ["https://x/a.jpg", "https://x/b.jpg"]);
  assert.deepEqual(selectLibraryCandidates([], {}), []);
});

test("heuristicPick chọn ảnh trùng từ khoá nhất (bỏ dấu tiếng Việt), không trùng thì trả null", () => {
  const candidates = [{ label: "Văn phòng làm việc", url: "1" }, { label: "Cà phê buổi sáng", url: "2" }];
  assert.equal(heuristicPick(candidates, { title: "Không gian cà phê mới", content: "" }).url, "2");
  assert.equal(heuristicPick(candidates, { title: "Tuyển dụng kế toán", content: "" }), null);
});

test("parsePickedItem đọc số AI trả về và từ chối số ngoài danh sách / 0", () => {
  const candidates = [{ url: "a" }, { url: "b" }];
  assert.equal(parsePickedItem("2", candidates).url, "b");
  assert.equal(parsePickedItem("Best: 1.", candidates).url, "a");
  assert.equal(parsePickedItem("0", candidates), null);
  assert.equal(parsePickedItem("7", candidates), null);
  assert.equal(parsePickedItem("none", candidates), null);
});

test("buildPickMessages đánh số ảnh và nêu rõ bài viết", () => {
  const messages = buildPickMessages([{ label: "Cà phê" }, { prompt_used: "an office" }], { title: "Quán mới", content: "Nội dung" });
  assert.match(messages[1].content, /1\. Cà phê/);
  assert.match(messages[1].content, /2\. an office/);
  assert.match(messages[1].content, /Quán mới/);
});
