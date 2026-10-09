import assert from "node:assert/strict";
import test from "node:test";

import { MAX_AUTO_IMAGES, detectMediaRequest, extractMediaFromSources } from "../src/domain/chat/productMedia.js";

test("detectMediaRequest nhận câu xin hình/video, có dấu hoặc không dấu", () => {
  assert.deepEqual(detectMediaRequest("Cho mình xem hình sản phẩm"), { image: true, video: false, any: true });
  assert.deepEqual(detectMediaRequest("gui anh va video di shop"), { image: true, video: true, any: true });
  assert.equal(detectMediaRequest("Clip review có không?").video, true);
  assert.equal(detectMediaRequest("giá bao nhiêu vậy").any, false);
  assert.equal(detectMediaRequest("hình thức thanh toán").any, false);
  assert.equal(detectMediaRequest("xem hình thức thanh toán và hình sản phẩm").image, true);
});

test("extractMediaFromSources lấy link ảnh/video trực tiếp trong tài liệu, bỏ trùng và link thường", () => {
  const sources = [
    { text: "Tai nghe Alien X1. Ảnh: https://cdn.x/a.jpg và https://cdn.x/b.PNG. Video: https://cdn.x/v.mp4. Xem thêm https://shop.x/san-pham" },
    { text: "Ảnh: https://cdn.x/a.jpg, https://cdn.x/c.webp." }
  ];
  const both = extractMediaFromSources(sources, { image: true, video: true, any: true });
  assert.deepEqual(both.map((m) => m.url), ["https://cdn.x/a.jpg", "https://cdn.x/b.PNG", "https://cdn.x/c.webp", "https://cdn.x/v.mp4"]);
  assert.deepEqual(extractMediaFromSources(sources, { image: false, video: true, any: true }).map((m) => m.type), ["video"]);
  assert.deepEqual(extractMediaFromSources(sources, { image: true, video: false, any: true }, { exclude: ["https://cdn.x/a.jpg"] }).map((m) => m.url), ["https://cdn.x/b.PNG", "https://cdn.x/c.webp"]);
  assert.deepEqual(extractMediaFromSources(sources, { image: false, video: false, any: false }), []);
  assert.deepEqual(extractMediaFromSources(null, { image: true, any: true }), []);
});

test("extractMediaFromSources giới hạn số ảnh và bỏ link không an toàn", () => {
  const many = { text: Array.from({ length: 9 }, (_, i) => `https://cdn.x/${i}.jpg`).join(" ") };
  assert.equal(extractMediaFromSources([many], { image: true, any: true }).length, MAX_AUTO_IMAGES);
  assert.deepEqual(extractMediaFromSources([many], { image: true, any: true }, { isSafeUrl: () => false }), []);
});
