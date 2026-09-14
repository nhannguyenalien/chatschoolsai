// Khách hàng dùng chung collection "tenants" với chủ shop (không tạo collection riêng) — tài
// khoản khách chỉ khác ở chỗ không có "tenant" và có "linked_phones_json" (mảng SĐT đã xác
// minh qua Telegram). Hai hàm thuần dưới đây tách khỏi phần gọi PocketBase để test được không
// cần mock fetch, theo đúng tinh thần domain/loyalty/points.js.

import { sumLedger } from "./loyalty/points.js";

export function parseLinkedPhones(linkedPhonesJson) {
  if (!linkedPhonesJson) return [];
  try {
    const parsed = JSON.parse(linkedPhonesJson);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string" && value.trim()) : [];
  } catch {
    return [];
  }
}

export function addLinkedPhone(linkedPhonesJson, phone) {
  const normalized = String(phone || "").trim();
  if (!normalized) throw new Error("Phone number is required.");
  const existing = parseLinkedPhones(linkedPhonesJson);
  if (existing.includes(normalized)) return existing;
  return [...existing, normalized];
}

// Gộp dữ liệu điểm/thưởng/tin nhắn của khách theo shop, xuyên nhiều tenant. `loyaltyCustomerRows`,
// `spinResults` và `messageRows` đã được lọc chỉ theo customer_ref/session của khách (không theo
// tenant) trước khi truyền vào đây. `messageRows` phải được sắp -created từ trước (mới nhất trước)
// để bản ghi đầu tiên gặp cho mỗi tenant chính là tin nhắn gần nhất.
export function buildCustomerOverview({ phones, loyaltyCustomerRows, ledgerByCustomerId, spinResults, messageRows, botNames }) {
  const shopsByTenant = new Map();
  const ensureShop = (tenant) => {
    if (!shopsByTenant.has(tenant)) {
      shopsByTenant.set(tenant, {
        tenant,
        shop_name: botNames?.[tenant] || tenant,
        balance: 0,
        rewards: [],
        last_message: null,
        last_message_at: null,
      });
    }
    return shopsByTenant.get(tenant);
  };

  for (const row of loyaltyCustomerRows || []) {
    const shop = ensureShop(row.tenant);
    shop.balance += sumLedger(ledgerByCustomerId?.[row.id] || []);
  }

  for (const result of spinResults || []) {
    const shop = ensureShop(result.tenant);
    shop.rewards.push({
      id: result.id,
      prize_name: result.prize_name,
      spun_at: result.spun_at || result.created,
      claimed: result.status === "claimed",
    });
  }

  for (const message of messageRows || []) {
    const shop = ensureShop(message.tenant);
    if (!shop.last_message) {
      shop.last_message = message.text;
      shop.last_message_at = message.created;
    }
  }

  const shops = Array.from(shopsByTenant.values())
    .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  return { phones: phones || [], shops };
}
