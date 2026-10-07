# Ads Agent (Meta Ads → Google Ads → YouTube) — thiết kế & lộ trình

Trạng thái: **giai đoạn 1 đã code (chưa deploy, chưa thử với ad account thật).** Chỉ ĐỌC dữ liệu và ĐỀ XUẤT, không ghi gì vào ad account. Hướng dẫn dùng/triển khai: mục "Ads Agent" trong `docs/API.md`.

Quyết định đã chốt: khách tự tạo System User token (`ads_read`) và dán vào dashboard, không qua OAuth/App Review của ta; một tenant có nhiều token, mỗi token nhiều ad account; báo cáo gửi Telegram và nằm trong bản tin Agent tổng.

## 1. Mục tiêu

Một agent theo dõi quảng cáo của từng tenant, báo cáo hằng ngày và cảnh báo bất thường, đề xuất hành động (scale / hold / pause / thử creative mới) để chủ tenant tự duyệt.

Không làm ở giai đoạn 1: tự đổi ngân sách, tự pause/bật quảng cáo, tự tạo campaign.

## 2. Tái dùng những gì đã có

| Cần | Đã có trong `worker-chat-d/knowledge-worker` |
|---|---|
| Vòng lặp model + tool | agent vận hành (`handleAgentRun`) và agent-chat, `tools` + `tool_choice:auto` |
| Tool khai báo theo tenant | collection `agent_tools` |
| Chờ xác nhận | `requires_confirmation` + `/agent-tool-proposals/:id/confirm` (dùng ở giai đoạn 3) |
| Đo token/chi phí theo tenant | `createMeteredAiFetch`, `domain/billing/costs.js` |
| Chọn model qua env/system-config | `OPENAI_CHAT_MODEL`, `GEMINI_MODEL`, `system-config.html` |
| Google OAuth (refresh token, mã hóa) | `integrations/googleAnalytics.js` |
| Facebook Graph | `integrations/facebookInsights.js` |
| Báo cáo gửi đi | Telegram alert, bản tin của master agent (`handleMasterDigest`) |
| Cron | `wrangler.jsonc` → `triggers.crons` |

Phần mới: tool gateway cho ads, model router, policy engine, schema lưu snapshot/đề xuất.

## 3. Kiến trúc giai đoạn 1

```text
cron (lồng vào tick sẵn có)
   │
   ▼
Ads Runner ── lấy danh sách tenant có ad account đã kết nối
   │
   ├─ Tool Gateway (CHỈ ĐỌC)
   │     meta.list_campaigns / meta.get_insights
   │     (sau này: google.*, youtube.*)
   │
   ├─ Rule Engine (code thuần, KHÔNG gọi model)
   │     tính ROAS/CPA/CTR/frequency, so với ngưỡng của tenant
   │     → nhãn SCALE / HOLD / PAUSE / WATCH
   │
   ├─ Model Router
   │     bình thường: model rẻ → tóm tắt báo cáo, viết lại cho dễ đọc
   │     bất thường (ROAS tụt, CPA tăng mạnh, nhiều campaign cùng xấu):
   │         model mạnh → chẩn đoán nguyên nhân + đề xuất
   │
   └─ Output: bản ghi `ads_reports` + `ads_recommendations` → Telegram / master agent
```

Nguyên tắc: **rule engine quyết định có cần model hay không.** Tenant không có gì bất thường thì bỏ qua hoàn toàn, không gọi model (giống agent hiện tại).

## 4. Model router

Cấu hình qua env/system-config, không hard-code tên model:

| Biến | Dùng cho | Gợi ý |
|---|---|---|
| `ADS_MODEL_CHEAP` | tóm tắt, phân loại, viết báo cáo | model nhỏ nhất đủ function-calling |
| `ADS_MODEL_STRONG` | chẩn đoán, đề xuất khi có bất thường | model tầm trung/mạnh |
| `ADS_MODEL_PREMIUM` | audit lớn, chỉ bật cho gói enterprise | để trống ở MVP |

Quy tắc leo thang (escalation): cheap → strong khi rule engine gắn cờ bất thường; strong → premium chỉ khi tenant bật và ngân sách đủ lớn. Mọi lời gọi đi qua `createMeteredAiFetch` với `kind` riêng (`ads`) để tách chi phí ads khỏi chat.

Tên model và giá phải đối chiếu trên trang giá của nhà cung cấp tại thời điểm triển khai, vì doc này không cố định chúng.

## 5. Meta Ads — điều kiện bắt buộc

Token Page hiện có (`facebook_pages.access_token`) **không đủ** cho Ads Insights.

- Quyền: `ads_read` (giai đoạn 1). `ads_management` chỉ cần từ giai đoạn 3.
- Cách lấy token: user token dài hạn hoặc System User của Business Manager. System User ưu tiên vì không hết hạn theo phiên người dùng.
- App phải qua **App Review** của Meta để dùng `ads_read` với tài khoản không phải của chính bạn. Nộp sớm, song song với code.
- Dữ liệu cần: `act_<id>/campaigns`, `act_<id>/insights` (spend, impressions, clicks, ctr, cpc, actions, purchase_roas, frequency), theo `date_preset` hoặc `time_range`.
- Lưu token mã hóa như cách GA4 đang làm (`encryptJson`), không lưu plaintext trong collection mới.

## 6. Dữ liệu (PocketBase, đề xuất)

- `ads_connections`: tenant, provider (`meta`|`google`), account_id, credentials_encrypted, status, last_error, thresholds_json
- `ads_snapshots`: tenant, provider, account_id, date, metrics_json (giữ lịch sử để so sánh 7 ngày)
- `ads_reports`: tenant, date, severity, summary, model_used, tokens
- `ads_recommendations`: tenant, campaign_id, action (`scale|hold|pause|test_creative`), reason, confidence, status (`new|accepted|dismissed`)

Ngưỡng mặc định (ví dụ ROAS thấp, CPA cao, frequency > 3.5) cho tenant chỉnh được trong `thresholds_json`. Không có ngưỡng mặc định tốt cho mọi ngành, nên phải cho chỉnh.

## 7. Ràng buộc kỹ thuật cần nhớ

1. **Số cron.** Gói Free chỉ cho 5 cron/tài khoản và dự án đang dùng 4 (`0 1 * * *`, `30 0 * * *`, `*/15 * * * *`, `0 * * * *`). Không thêm cron mới; lồng vào tick `0 * * * *` (chỉ chạy ads ở một giờ cố định trong ngày, ví dụ 07:00 VN, và kiểm tra bất thường nhẹ mỗi vài giờ).
2. **Giới hạn subrequest/thời gian của Worker.** Mỗi tenant có thể cần nhiều lời gọi Graph API. Chia tenant theo lô, mỗi tick chỉ xử lý một lô nhỏ, ghi con trỏ tiến độ.
3. **`src/index.js` đã ~7.7k dòng.** Code ads đặt module riêng: `src/domain/ads/` (rule engine, router), `src/integrations/metaAds.js`. `index.js` chỉ nối route và cron.
4. **Test.** Dự án có test cho từng domain; rule engine và router phải có test trước khi nối vào cron.

## 8. Bảo mật & chi phí

- Dữ liệu ads là dữ liệu kinh doanh nhạy cảm: gửi cho model chỉ số đã tổng hợp, không gửi token, không gửi dữ liệu khách hàng cuối.
- Token/credentials mã hóa, không in vào log.
- Giới hạn số lần leo thang lên model mạnh mỗi tenant mỗi ngày để chặn chi phí đột biến.
- Hiển thị chi phí AI của ads trong trang billing nhờ `kind` riêng.

## 9. Lộ trình

| GĐ | Nội dung | Điều kiện |
|---|---|---|
| 1 | Meta Ads chỉ đọc + rule engine + model router + báo cáo Telegram/master agent | Token `ads_read` (dùng ad account của chính mình để dev, App Review cho khách) |
| 2 | Google Ads chỉ đọc, YouTube Data API | Google Developer Token, OAuth scope `adwords` (tách khỏi GA4) |
| 3 | Thao tác ghi qua `requires_confirmation` + policy giới hạn (ví dụ ngân sách ±20%/lần) | `ads_management`, test kỹ, audit log |
| 4 | Model premium cho audit lớn | Có khách enterprise |

Ghi chú YouTube: quảng cáo video YouTube chạy qua Google Ads (Video campaigns), nên gộp vào tích hợp Google Ads. YouTube Data API chỉ dùng để đọc số liệu kênh/video.

## 10. Câu hỏi còn mở

1. Khách có Business Manager và ad account Meta chưa? (quyết định dùng System User hay user token)
2. Báo cáo hiện ở đâu trước: Telegram, `master-agent.html`, hay trang mới?
3. Một tenant có thể có nhiều ad account không? (ảnh hưởng schema `ads_connections`)
4. Ngưỡng mặc định lấy theo ngành nào để bắt đầu?
