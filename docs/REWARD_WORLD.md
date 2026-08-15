# Reward World (MVP)

Reward World là danh mục chương trình quay thưởng cấp hệ thống. Cửa hàng không tạo hoặc sửa luật; cửa hàng chỉ tham gia chương trình đang mở.

## Cài schema PocketBase

Import `scripts/loyalty-collections.json` trong PocketBase Dashboard > Settings > Import collections. Chọn giữ các collection khác; file cập nhật/thêm 9 collection loyalty.

Nếu đã import bản loyalty cũ, import lại file mới để thêm các collection `reward_*` và field `reward_spin_results.prize_slot_key`.

## Tạo chương trình toàn hệ thống

Mở `dash-tabler/reward-world-admin.html` và đăng nhập bằng tài khoản PocketBase superuser. Phiên đăng nhập được giữ trong auth store của trình duyệt; trang quản trị thao tác trực tiếp các collection toàn hệ thống và không dùng API key cửa hàng.

Không xóa campaign hoặc giải đã chạy; chuyển sang `paused` hay `ended` để giữ lịch sử đối soát.

Bạn cũng có thể tạo record trực tiếp bằng PocketBase superuser:

1. Tạo một record trong `reward_campaigns`:
   - `name`: `Vòng quay khai trương`
   - `status`: `active`
   - `spend_per_spin_minor`: `100000` (100.000 VND nếu đơn vị tiền nhỏ nhất là 1 VND)
   - `max_spins_per_sale`: `3`
   - `theme_json`: `{}`
2. Tạo các record trong `reward_campaign_prizes`, dùng ID campaign vừa tạo:
   - Trượt: `prize_type=none`, `weight=70`, `max_wins=0`, `status=active`, `sort_order=1`, `value_json={}`
   - Voucher 20K: `prize_type=voucher`, `weight=25`, `max_wins=1000`, `status=active`, `sort_order=2`, `value_json={"amount_minor":20000}`
   - Quà lớn: `prize_type=product`, `weight=5`, `max_wins=10`, `status=active`, `sort_order=3`, `value_json={"sku":"GIFT-001"}`

`weight` là trọng số tương đối, không bắt buộc tổng bằng 100. `max_wins=0` nghĩa là không giới hạn.

## Luồng cửa hàng

1. `GET /api/v1/loyalty/reward-world/campaigns` để xem chương trình chung.
2. `POST /api/v1/loyalty/reward-world/campaigns/:campaignId/join` để tham gia một lần.
3. Ghi đơn qua `POST /api/v1/loyalty/sales`. Server tự cấp lượt quay theo ngưỡng chung của campaign.
4. `POST /api/v1/loyalty/reward-world/spins` với:

```json
{
  "campaign_id": "CAMPAIGN_RECORD_ID",
  "customer_ref": "0909000000",
  "idempotency_key": "spin-device-unique-001"
}
```

Tenant luôn lấy từ API key, không nhận từ body. Kết quả được server quyết định bằng random bảo mật; một entitlement chỉ dùng được một lần. `prize_slot_key` có unique index để không phát vượt `max_wins` khi có các lượt quay đồng thời.

## Giao thưởng

Cửa hàng tra khách trong trang Loyalty và bấm **Xác nhận đã giao**. Mỗi lần giao tạo một record append-only trong `reward_claims`; unique index trên `result_id` ngăn nhận hai lần dù request lặp hoặc hai nhân viên bấm đồng thời.

## Reward Catalog và nguồn quà

Import thêm `scripts/reward-catalog-collections.json` để tạo `reward_catalog_items` và `reward_fulfillments`. Catalog dùng một schema chung cho cả quà từ kho POS và gift card Reloadly; campaign prize chỉ cần đặt `value_json.catalog_item_id` bằng ID catalog item.

- `POST /api/v1/admin/reward-world/catalog/sync/self` đồng bộ tồn kho POS vào catalog.
- `POST /api/v1/admin/reward-world/catalog/sync/reloadly` đồng bộ sản phẩm Reloadly; body có thể chứa `country_code`, `page`, `per_page`.
- `GET /api/v1/admin/reward-world/catalog?provider=self|reloadly&status=active` đọc catalog thống nhất.

Các endpoint trên yêu cầu `X-Admin-Secret`. Worker cần các secret sau:

- POS: `POS_API_KEY`; `POS_API_URL` là biến tùy chọn, mặc định `https://pos-app-bq8.pages.dev`.
- Reloadly: `RELOADLY_CLIENT_ID`, `RELOADLY_CLIENT_SECRET`; `RELOADLY_ENV=live` khi chạy production, mặc định là sandbox.

Khi claim quà POS, router ghi một giao dịch `OUT` đúng một đơn vị vào kho. Khi claim gift card Reloadly, Reloadly gửi mã trực tiếp đến email người nhận; hệ thống chỉ lưu transaction ID và trạng thái, không lưu mã/PIN. Nếu provider trả lỗi hoặc kết quả mạng không xác định, fulfillment chuyển `manual_review` và không tự trừ/gửi lại để tránh cấp quà hai lần.

## Giới hạn MVP

- AI chưa tham gia quyết định giải. Khi thêm AI, AI chỉ nên xếp hạng nhóm phần thưởng; eligibility, tồn kho, ngân sách và kết quả cuối vẫn phải qua rule engine deterministic.
