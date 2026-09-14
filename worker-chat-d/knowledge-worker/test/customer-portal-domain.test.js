import test from "node:test";
import assert from "node:assert/strict";
import { addLinkedPhone, buildCustomerOverview, parseLinkedPhones } from "../src/domain/customerPortal.js";

test("parseLinkedPhones tolerates missing, malformed, or non-array JSON", () => {
  assert.deepEqual(parseLinkedPhones(null), []);
  assert.deepEqual(parseLinkedPhones(""), []);
  assert.deepEqual(parseLinkedPhones("not json"), []);
  assert.deepEqual(parseLinkedPhones('"just a string"'), []);
  assert.deepEqual(parseLinkedPhones('["0900000000"]'), ["0900000000"]);
});

test("addLinkedPhone appends a new phone and dedupes an existing one", () => {
  assert.deepEqual(addLinkedPhone(null, "0900000000"), ["0900000000"]);
  assert.deepEqual(addLinkedPhone('["0900000000"]', "0911111111"), ["0900000000", "0911111111"]);
  assert.deepEqual(addLinkedPhone('["0900000000"]', "0900000000"), ["0900000000"]);
});

test("addLinkedPhone rejects an empty phone", () => {
  assert.throws(() => addLinkedPhone(null, "   "), /Phone number is required/);
});

test("buildCustomerOverview groups balance and rewards per shop across tenants", () => {
  const overview = buildCustomerOverview({
    phones: ["0900000000"],
    loyaltyCustomerRows: [
      { id: "cust-a", tenant: "shop-a" },
      { id: "cust-b", tenant: "shop-b" },
    ],
    ledgerByCustomerId: {
      "cust-a": [{ points_delta: 100 }, { points_delta: -20 }],
      "cust-b": [{ points_delta: 30 }],
    },
    spinResults: [
      { id: "r1", tenant: "shop-a", prize_name: "Voucher 50k", spun_at: "2026-01-01", status: "won" },
      { id: "r2", tenant: "shop-c", prize_name: "Trà sữa", spun_at: "2026-01-02", status: "claimed" },
    ],
    botNames: { "shop-a": "Cafe A", "shop-b": "Cafe B" },
  });

  assert.equal(overview.shops.length, 3);
  const byTenant = Object.fromEntries(overview.shops.map((shop) => [shop.tenant, shop]));
  assert.equal(byTenant["shop-a"].shop_name, "Cafe A");
  assert.equal(byTenant["shop-a"].balance, 80);
  assert.equal(byTenant["shop-a"].rewards.length, 1);
  assert.equal(byTenant["shop-b"].balance, 30);
  assert.equal(byTenant["shop-b"].rewards.length, 0);
  // shop-c only appears via a spin result, never a loyalty_customers row — still surfaced,
  // and falls back to the raw tenant slug when no bot_configs name was resolved for it.
  assert.equal(byTenant["shop-c"].shop_name, "shop-c");
  assert.equal(byTenant["shop-c"].balance, 0);
  assert.equal(byTenant["shop-c"].rewards[0].claimed, true);
});

test("buildCustomerOverview surfaces chat-only shops and sorts by most recent message", () => {
  const overview = buildCustomerOverview({
    phones: [],
    loyaltyCustomerRows: [{ id: "cust-a", tenant: "shop-a" }],
    ledgerByCustomerId: { "cust-a": [{ points_delta: 50 }] },
    spinResults: [],
    // Đã sort -created từ server: bản ghi đầu tiên gặp cho mỗi tenant là tin mới nhất.
    messageRows: [
      { tenant: "shop-b", text: "Chào shop B", created: "2026-02-01T00:00:00Z" },
      { tenant: "shop-a", text: "Còn hàng không?", created: "2026-01-15T00:00:00Z" },
      { tenant: "shop-a", text: "Xin chào", created: "2026-01-10T00:00:00Z" },
    ],
    botNames: { "shop-a": "Cafe A", "shop-b": "Quan B" },
  });

  // shop-b chưa từng mua hàng (không có loyaltyCustomerRows) nhưng vẫn phải xuất hiện vì đã chat.
  assert.deepEqual(overview.shops.map((shop) => shop.tenant), ["shop-b", "shop-a"]);
  const byTenant = Object.fromEntries(overview.shops.map((shop) => [shop.tenant, shop]));
  assert.equal(byTenant["shop-b"].balance, 0);
  assert.equal(byTenant["shop-b"].last_message, "Chào shop B");
  assert.equal(byTenant["shop-a"].balance, 50);
  // Tin nhắn mới nhất của shop-a là bản ghi đầu tiên gặp trong mảng, không phải bản ghi cuối.
  assert.equal(byTenant["shop-a"].last_message, "Còn hàng không?");
});
