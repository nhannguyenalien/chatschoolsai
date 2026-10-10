import assert from "node:assert/strict";
import test from "node:test";

import { buildDescribeMessages, cleanDescription, isGenericLabel } from "../src/domain/media/imageLabel.js";

test("isGenericLabel nhận ra tên file / mã máy ảnh / rỗng nhưng giữ nhãn do người dùng tự đặt", () => {
  for (const generic of ["", "  ", "IMG_2031.jpg", "photo.png", "DSC00123", "Screenshot 2026-10-10 at 9.41.12", "7c9e6679-7425-40de-944b-e07fc1f90ae7", "20261010_093000", "WhatsApp Image 2026-10-10"]) {
    assert.equal(isGenericLabel(generic), true, generic);
  }
  for (const real of ["Bàn làm việc gỗ sồi", "Đội ngũ tư vấn", "Logo thương hiệu", "Quán cà phê buổi sáng", "Spring sale banner"]) {
    assert.equal(isGenericLabel(real), false, real);
  }
});

test("cleanDescription lấy dòng đầu, bỏ tiền tố/ngoặc kép/dấu chấm cuối và giới hạn 100 ký tự", () => {
  assert.equal(cleanDescription('Label: "Cô gái cười bên chú chó đốm."'), "Cô gái cười bên chú chó đốm");
  assert.equal(cleanDescription("\n\nNúi tuyết phủ mây\nghi chú thêm"), "Núi tuyết phủ mây");
  assert.equal(cleanDescription("x".repeat(300)).length, 100);
  assert.equal(cleanDescription(null), "");
});

test("buildDescribeMessages gửi ảnh dạng data URL và ghi rõ ngôn ngữ", () => {
  const messages = buildDescribeMessages("data:image/png;base64,AAAA", "English");
  assert.match(messages[0].content, /English/);
  assert.equal(messages[1].content[1].image_url.url, "data:image/png;base64,AAAA");
});
