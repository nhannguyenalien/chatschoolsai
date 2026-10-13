import test from "node:test";
import assert from "node:assert/strict";
import { markdownToChannelText } from "../src/domain/chat/channelText.js";

const sample = "**Digital Camera** — giá **185,00 USD**\n\n![Digital Camera](https://s.test/a.jpg)\n\n[Xem/mua](https://s.test/p/camera/)\n\n## Ghi chú\n* còn hàng\n* `bảo hành` 12 tháng";

test("markdown is turned into plain text for Messenger/Instagram", () => {
  const out = markdownToChannelText(sample);
  assert.doesNotMatch(out, /!\[|\]\(|\*\*|##|`/);
  assert.match(out, /Digital Camera — giá 185,00 USD/);
  assert.match(out, /Xem\/mua: https:\/\/s\.test\/p\/camera\//);
  assert.doesNotMatch(out, /a\.jpg/);
  assert.match(out, /- còn hàng/);
  assert.doesNotMatch(out, /\n{3,}/);
});

test("WhatsApp keeps bold in its own *single-star* syntax", () => {
  const out = markdownToChannelText("Giá **185 USD**", { platform: "whatsapp" });
  assert.equal(out, "Giá *185 USD*");
});

test("channels without attachments can keep image URLs as text", () => {
  assert.equal(markdownToChannelText("![Máy ảnh](https://s.test/a.jpg)", { keepImageLinks: true }), "Máy ảnh: https://s.test/a.jpg");
});

test("plain links and empty input are left alone", () => {
  assert.equal(markdownToChannelText("Xem https://s.test/x và [https://s.test/y](https://s.test/y)"), "Xem https://s.test/x và https://s.test/y");
  assert.equal(markdownToChannelText(null), "");
});
