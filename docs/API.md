# API cho hệ thống ngoài gọi vào

Base URL: `https://apic.schoolsai.work` (đổi theo domain worker thật của bạn — xem `routes` trong `worker-chat-d/knowledge-worker/wrangler.jsonc`).

Toàn bộ endpoint dưới đây nằm trong worker `worker-chat-d/knowledge-worker/src/index.js`. Không cần chạy thêm dịch vụ nào khác.

## Xác thực

Mỗi tenant có 1 **API key** riêng, lấy tại `config.html` → card "API cho hệ thống ngoài" → bấm **Tạo / Đổi mới**.

Gửi kèm 1 trong 2 cách:

```
Authorization: Bearer <API_KEY>
```

hoặc query param (tiện để test nhanh, KHÔNG khuyến khích dùng lâu dài vì key lộ trong log):

```
?api_key=<API_KEY>
```

Sai/thiếu key → `401 {"error": "API key không hợp lệ"}`.

Mọi request/response đều là JSON. Không cần các header khác.

---

## `POST /api/v1/posts` — Tạo bài viết mới

Tạo bài + tự tạo `post_targets` cho các platform chỉ định (dùng page/token đã cấu hình sẵn ở `sm-config.html`). Đây là cách để hệ thống ngoài "bơm" nội dung vào thẳng, bỏ qua bước RSS/AI viết bài nếu không cần.

**Request:**
```json
{
  "title": "Căn hộ view biển Đà Nẵng",
  "content": "Nội dung đầy đủ để đăng lên mạng xã hội...",
  "image_prompt": "mô tả ảnh (tuỳ chọn, chỉ để tham khảo, không tự sinh ảnh ở bước này)",
  "image_url": "https://... (tuỳ chọn — ảnh có sẵn, worker sẽ gắn vào bài)",
  "video_url": "https://... (tuỳ chọn, dùng thay image_url nếu là video)",
  "platforms": ["facebook", "instagram"],
  "auto_approve": false
}
```

- `title`, `content`: **bắt buộc**.
- `platforms`: mặc định `["facebook"]` nếu bỏ trống. Platform nào chưa có page/token active trong `pages_config` sẽ bị bỏ qua âm thầm (không tạo target cho platform đó).
- `auto_approve`: `true` → target tạo ra ở trạng thái `approved` (worker sẽ tự đăng thật trong vòng tối đa 15 phút, KHÔNG cần ai duyệt tay). `false`/bỏ trống → trạng thái `pending`, phải duyệt tay ở `composer.html` hoặc gọi `POST /api/v1/posts/:id/approve`.
- Instagram bắt buộc phải có `image_url` hoặc `video_url` — thiếu thì target sẽ báo lỗi khi tới lượt đăng (không chặn lúc tạo).
- Nội dung dài quá 2200 ký tự sẽ đăng Facebook bình thường nhưng lỗi ở Instagram (giới hạn thật của Meta) — target đó sẽ chuyển sang `error` kèm `error_log` giải thích.

**Response:**
```json
{
  "success": true,
  "post_id": "abc123",
  "targets": [
    { "id": "t1", "platform": "facebook", "status": "pending" },
    { "id": "t2", "platform": "instagram", "status": "pending" }
  ]
}
```

---

## `GET /api/v1/posts?status=pending` — Danh sách bài viết

`status` (tuỳ chọn): lọc bài có ít nhất 1 target đang ở trạng thái này — `pending` / `approved` / `scheduled` / `publishing` / `published` / `error`. Bỏ trống = lấy 50 bài mới nhất.

`cluster_id`/`slug`/`meta_title`/`meta_description`/`focus_keyword` chỉ có giá trị với bài tạo từ `/api/v1/content-cluster` — bài từ RSS hoặc tạo tay trong `composer.html` thì các field này rỗng.

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "id": "abc123",
      "title": "...",
      "content": "...",
      "created": "2026-07-26 08:00:00.000Z",
      "cluster_id": "cl_...",
      "slug": "...",
      "meta_title": "...",
      "meta_description": "...",
      "focus_keyword": "...",
      "targets": [
        { "id": "t1", "platform": "facebook", "status": "published", "scheduled_at": "", "error_log": "", "published_post_id": "123456" }
      ],
      "media": [{ "url": "https://...", "type": "image" }]
    }
  ]
}
```

---

## `POST /api/v1/posts/:id/approve` — Duyệt đăng

Chuyển TẤT CẢ target đang `pending` của bài này sang `approved`. Worker sẽ tự đăng thật trong tối đa 15 phút (theo lịch cron `*/15 * * * *`), hoặc gọi luôn `POST /api/v1/trigger/publish` để đăng ngay không cần chờ.

**Response:** `{"success": true, "approved": 2}`

---

## `GET /api/v1/status` — Xem nhanh tình trạng

Đếm số `post_targets` theo từng trạng thái của tenant gọi API (theo API key).

**Response:**
```json
{
  "success": true,
  "tenant": "bds",
  "pending": 3,
  "approved": 1,
  "scheduled": 0,
  "publishing": 0,
  "published": 42,
  "error": 2
}
```

---

## `POST /api/v1/trigger/rss-crawl` — Kích hoạt crawl RSS ngay

Chạy ngay lập tức bước "crawl RSS đang Hoạt động của tenant này + AI viết bài nháp", không cần chờ tới 07:30 sáng hôm sau. Không cần body.

**Response:** `{"success": true}`

---

## `POST /api/v1/trigger/publish` — Kích hoạt đăng ngay

Chạy ngay bước "đăng các bài đã `approved`/tới giờ `scheduled`" của tenant này, không cần chờ chu kỳ 15 phút.

**Response:** `{"success": true}`

---

## `POST /api/v1/trigger/agent` — Chạy Agent ngay cho tenant này

Bình thường Agent tự chạy mỗi giờ (`0 * * * *`). Gọi endpoint này để chạy ngay không cần chờ.

**Cách hoạt động:** Agent đọc snapshot hiện tại của tenant (bài chờ duyệt, bài lỗi, escalation tồn đọng, tình trạng nguồn RSS), đưa cho model (`OPENAI_CHAT_MODEL`, cấu hình ở `system-config.html`) kèm 5 tool nó được phép gọi:

| Tool | Việc gì | An toàn vì |
|---|---|---|
| `trigger_publish` | Đăng bài đã duyệt | Không tự duyệt nội dung mới, chỉ thực thi cái người đã duyệt |
| `trigger_rss_crawl` | Crawl RSS, viết bài nháp | Bài vẫn ở trạng thái chờ duyệt |
| `pause_rss_source` | Tạm dừng nguồn RSS lỗi liên tục | Đảo ngược được (bật lại trong composer.html) |
| `send_alert` | Gửi cảnh báo Telegram cho chủ | Chỉ là thông báo, không thay đổi dữ liệu |
| `no_action` | Không làm gì | Agent luôn có lựa chọn "không cần làm gì" |

Nếu tenant không có gì bất thường (mọi số liệu đều 0), Agent **bỏ qua hoàn toàn, không gọi model** — tiết kiệm token, giống nguyên tắc digest.

**Tool tùy chỉnh (khách tự khai báo, không cần code):** ngoài 5 tool có sẵn ở trên, mỗi tenant có thể tự thêm tool gọi API ngoài bất kỳ, khai báo trực tiếp trong `config.html` → card "Tool tùy chỉnh cho Agent" (lưu vào collection `agent_tools`). Mỗi tool cần:

| Trường | Ý nghĩa |
|---|---|
| `name` | Tên tool (chỉ chữ/số/`_`) — model gọi tool bằng đúng tên này |
| `description` | Mô tả cho model biết **khi nào** nên gọi tool này |
| `parameters_schema` | JSON Schema chuẩn OpenAI function-calling cho tham số |
| `method`, `url_template` | HTTP method + URL, dùng `{tên_tham_số}` để chèn giá trị model chọn vào URL |
| `headers_template` | JSON headers (vd API key của dịch vụ ngoài) |
| `result_path` | (tùy chọn) đường dẫn lấy field trong response JSON làm kết quả, vd `data.status` |

Agent nạp toàn bộ tool đang `is_active=true` của tenant mỗi lần chạy, gộp chung với 5 tool có sẵn rồi gửi cho model — không cần deploy lại code cho mỗi API mới.

**Response:** `{"success": true}` — xem log thật (đã gọi tool nào, quyết định ra sao) qua `npx wrangler tail`.

**Trạng thái verify:** đã xác nhận sống end-to-end trên dữ liệu thật — routing, auth, đọc snapshot đúng cho từng tenant, tự bỏ qua khi không có gì bất thường, VÀ nhánh gọi model + tool thật (test bằng cách tạo 1 escalation thật qua `/api/v1/chat`, agent phát hiện đúng, gọi được model qua proxy OpenAI kèm tool, model tự quyết định hợp lý).

---

## `POST /api/v1/content-cluster` — Lên plan + viết 1 cụm bài blog dài chuẩn SEO

Đưa vào 1 chủ đề lớn, AI tự lên kế hoạch N bài (1 bài "trụ"/pillar + N-1 bài "vệ tinh"/cluster), viết từng bài dài (800-1200 từ), tự chèn link nội bộ giữa các bài trong cùng cụm, kèm SEO meta (title/description/focus keyword) và ảnh minh hoạ (DALL-E).

Request:
```json
{ "topic": "Quản lý tồn kho vàng bạc cho tiệm vàng nhỏ", "count": 5 }
```
`count` mặc định 5, tối đa 8, tối thiểu 2 (1 pillar + ít nhất 1 cluster).

Response (trả về **ngay lập tức**, không đợi viết xong):
```json
{
  "success": true,
  "cluster_id": "cl_...",
  "planned": [
    { "title": "...", "slug": "...", "role": "pillar" },
    { "title": "...", "slug": "...", "role": "cluster" }
  ],
  "message": "Đang viết N bài trong nền, sẽ xuất hiện trong composer.html sau vài phút để bạn duyệt trước khi đăng."
}
```

**Vì sao trả lời ngay mà chưa viết xong:** viết 5-8 bài dài + sinh ảnh có thể mất vài phút — quá lâu để giữ 1 request HTTP chờ. Bước lên plan (nhanh, 1 lần gọi AI) chạy ngay và trả về, còn việc viết từng bài chạy nền (`ctx.waitUntil`). Bài viết sẽ lần lượt xuất hiện trong `composer.html` với trạng thái chờ duyệt — same nguyên tắc "AI không tự đăng khi chưa duyệt" như luồng RSS.

Cũng gọi được ngay trong **Chat với Agent** (`agent-chat.html`) bằng câu tự nhiên kiểu "viết 5 bài về X" — tool `plan_content_cluster`.

**Đăng lên WordPress/Sanity:** nếu tenant đã kết nối kênh `wordpress`/`sanity` (is_active=true) trong `sm-config.html`, mỗi bài trong cụm tự động có sẵn `post_targets` (status=`pending`) cho các kênh đó — duyệt trong `composer.html` là đăng được, giống Facebook/Instagram.

- WordPress: `page_id` = site URL, `access_token` = `username:application_password` (tạo ở WP Admin → Users → Profile → Application Passwords).
- Sanity: `page_id` = `projectId:dataset`, `access_token` = API token (sanity.io/manage, quyền Editor+). `extra_config` (JSON, tuỳ chọn) đổi tên document type/field cho khớp schema riêng: `{"docType":"post","titleField":"title","slugField":"slug","bodyField":"body","excerptField":"excerpt"}`. Nội dung ghi dạng Portable Text (chuyển tự động từ HTML), link nội bộ giữ nguyên dạng mark "link" thật — không phải chữ suông.

---

## `GET/POST /api/v1/schedules`, `PATCH/DELETE /api/v1/schedules/:id` — Lịch đăng bài tự động

Luật ngày/giờ để tự động xếp bài đã duyệt vào 1 cadence đều đặn, theo từng loại nội dung — thay vì đăng ngay khi duyệt.

**Cách hoạt động:** duyệt 1 bài trong `composer.html`, chọn trạng thái "Đã lên lịch" (`scheduled`) nhưng **để trống** ô giờ cụ thể → bài này ở trạng thái "chờ xếp lịch". Cứ mỗi 15 phút (cùng nhịp với publish dispatch), hệ thống khớp các luật đang bật với hôm nay, rồi gán giờ cụ thể cho bài chờ CŨ NHẤT (FIFO) của đúng loại nội dung vào từng khung giờ trống.

`content_type`: `"blog"` (áp dụng cho target platform `wordpress`/`sanity`) hoặc `"social"` (`facebook`/`instagram`/`linkedin`).

Request tạo luật:
```json
{ "content_type": "blog", "days": ["mon", "wed", "fri"], "times": ["09:00"], "is_active": true }
```
- `days`: mảng trong `["mon","tue","wed","thu","fri","sat","sun"]`. Để trống `[]` = áp dụng hàng ngày.
- `times`: mảng giờ `"HH:MM"` — **mỗi giờ = 1 bài/ngày áp dụng**. Vd `["08:00","12:00","18:00"]` = 3 bài social/ngày.

Response GET:
```json
{ "success": true, "schedules": [{ "id": "...", "content_type": "blog", "days": ["mon","wed","fri"], "times": ["09:00"], "is_active": true }] }
```

Quản lý trực quan hơn ở tab "Lịch đăng bài" trong `composer.html`, hoặc gọi thẳng trong **Chat với Agent** bằng câu tự nhiên kiểu "mỗi ngày đăng 3 bài social lúc 8h, 12h, 18h" — tool `add_publish_schedule`/`delete_publish_schedule`.

---

## `POST /api/v1/chat-link` — Tạo link chat riêng cho 1 khách hàng

Dùng khi hệ thống ngoài (vd phần mềm POS đã có sẵn 1 tài khoản/tenant ở đây — **không tạo tenant mới**) muốn tự tạo 1 link chat gắn sẵn tên khách rồi gửi cho khách (SMS/Zalo/email...). Khách mở link là vào thẳng cuộc chat, đã tự động được chào đúng tên — không cần khách tự nhập gì.

Request:
```json
{ "customer_name": "Chị Hoa" }
```
Response:
```json
{
  "success": true,
  "session": "22c29691-3838-4ca6-8b67-0cc7e7b457b3",
  "chat_url": "https://chat.schoolsai.work/chat.html?bot=<tenant>&session=22c29691-...&u=Ch%E1%BB%8B%20Hoa"
}
```

Không tạo bản ghi nào trong DB trước — widget `chat.html` đã tự đọc `session`/tên khách (`u`) từ URL và tự lưu vào localStorage khi khách mở link, nên chỉ cần đúng URL là đủ. Muốn xem lại hội thoại của khách này sau: `GET /api/v1/messages?session=<session>`.

Cũng gọi được ngay trong **Chat với Agent** bằng câu kiểu "tạo link chat cho khách tên Anh Tuấn" — tool `create_chat_link`.

---

## `POST /api/v1/chat` — Gọi chatbot

Gửi 1 câu hỏi, nhận câu trả lời AI ngay trong response (giống hệt widget chat, nhưng xác thực bằng API key thay vì để tenant tự khai trong body). Dùng khi hệ thống ngoài muốn tự hỏi bot thay vì nhúng widget.

**Request:**
```json
{ "session": "external-session-001", "question": "Giá căn hộ 2PN bao nhiêu?" }
```
- `session`: tự đặt (dùng để nhóm hội thoại nhiều lượt — AnythingLLM giữ ngữ cảnh theo session này).
- `question`: **bắt buộc**.
- `tenant` gửi kèm (nếu có) sẽ bị **bỏ qua** — luôn dùng đúng tenant của API key.

**Response:** `{"success": true, "reply": "Dạ căn hộ 2PN giá từ..."}`

Lưu ý: câu trả lời cũng được lưu vào `messages` như chat thật — sẽ tính vào `message_limit` của gói và có thể kích hoạt cơ chế handoff nếu AI không chắc chắn (xem phần Handoff ở README chính).

---

## `GET /api/v1/config` / `PATCH /api/v1/config` — Cấu hình bot

**GET** trả về cấu hình hiện tại (không trả `api_key`/`cloudinary_api_secret`/`cloudinary_api_key` vì lý do bảo mật — đọc các field đó thì vào `config.html`):
```json
{
  "success": true,
  "config": {
    "tenant": "bds",
    "bot_name": "Trợ lý BĐS",
    "bot_avatar": "🤖",
    "color": "#007f9d",
    "webhook": "https://...",
    "greeting": "Xin chào!",
    "system_prompt": "...",
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 1000,
    "streaming": true,
    "owner_telegram_chat_id": "123456789",
    "cloudinary_cloud_name": "dxyz1234",
    "brand_logo_url": "https://..."
  }
}
```

**PATCH** chỉ cần gửi field muốn đổi, các field khác giữ nguyên:
```json
{ "system_prompt": "Prompt mới...", "temperature": 0.5 }
```
Response: `{"success": true, "updated": ["system_prompt", "temperature"]}`

Field được phép sửa: `bot_name, bot_avatar, color, webhook, greeting, system_prompt, model, temperature, max_tokens, streaming, owner_telegram_chat_id, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret, brand_logo_url`. Không sửa được `tenant`/`api_key` qua endpoint này (đổi API key phải vào `config.html`, để tránh tự thu hồi quyền của chính mình qua API).

---

## `POST /api/v1/agent-chat` — Chat với Trợ lý cấu hình

Nói chuyện tự nhiên thay vì tự vào từng form — model tự chọn tool để ghi cấu hình qua PocketBase (system prompt, tên bot, Telegram chat id, Cloudinary, kết nối trang Facebook/Instagram/WhatsApp/Zalo, thêm tool API ngoài cho Agent). Client tự giữ lịch sử hội thoại và gửi kèm mỗi lần gọi (stateless phía server).

Request:
```json
{
  "messages": [
    { "role": "user", "content": "kết nối trang Facebook id 123456789 token EAAxxxx" }
  ]
}
```
Response:
```json
{ "success": true, "reply": "Đã kết nối trang facebook: 123456789" }
```

Lưu ý bảo mật: nội dung gửi lên (kể cả token/API key nếu khách dán vào chat) sẽ đi qua model AI (`OPENAI_BASE_URL`) để xử lý — không phải chỉ đi thẳng vào DB. Đã có cảnh báo hiển thị ngay trên UI `agent-chat.html`.

Để tránh model tự đoán/bịa giá trị khi khách hỏi "hiện tại đang cấu hình gì", server tự nhét sẵn snapshot cấu hình thật (bot config + trang đã kết nối + tool tùy chỉnh) vào system prompt mỗi lần gọi — không chỉ trông chờ model chủ động gọi tool `get_current_config`.

**Tool tùy chỉnh (agent_tools) gọi được ngay trong chat:** bất kỳ tool nào bạn đã khai báo qua card "Tool tùy chỉnh cho Agent" (config.html) hoặc qua chính chat này (`add_agent_tool`) đều được nạp và trao cho model mỗi lần gọi — không chỉ AI Agent tự động (chạy mỗi giờ) mới dùng được. Ví dụ: khai báo 1 tool gọi API Coolify (deploy/restart service, kiểm tra trạng thái...) rồi ra lệnh thẳng trong chat, model sẽ tự gọi nếu khớp với mô tả tool.

---

## `GET /api/v1/agent-chat/tools` — Danh sách tool THẬT của Trợ lý cấu hình

Trả về đúng danh sách tool mà `/api/v1/agent-chat` có thể gọi — lấy trực tiếp từ mảng `CONFIG_CHAT_TOOLS` trong code (nguồn duy nhất), không phải tài liệu viết tay có thể lệch dần theo thời gian. Dùng để hiển thị "Agent có thể làm được gì?" trên UI.

Response:
```json
{
  "success": true,
  "tools": [
    { "name": "update_bot_config", "description": "..." },
    { "name": "add_page_config", "description": "..." },
    { "name": "add_agent_tool", "description": "..." },
    { "name": "get_current_config", "description": "..." }
  ]
}
```

Lưu ý: đây là tool của **Trợ lý cấu hình** (chat trực tiếp với khách), khác với tool của **AI Agent vận hành** tự động chạy mỗi giờ (`AGENT_TOOLS` + `agent_tools` tùy chỉnh trong `config.html`) — 2 agent tách biệt, không dùng chung danh sách tool.

---

## `GET /api/v1/knowledge` / `POST /api/v1/knowledge` / `DELETE /api/v1/knowledge/:id` — Knowledge Base

**GET** — danh sách tài liệu đã nạp:
```json
{ "success": true, "documents": [{ "id": "d1", "title": "Bảng giá 2026", "char_count": 3200, "created": "..." }] }
```

**POST** — nạp tài liệu mới (text thô, worker tự embed vào AnythingLLM):
```json
{ "title": "Bảng giá 2026", "text": "Nội dung tài liệu đầy đủ..." }
```
Response: `{"success": true, "doc_id": "d1", "chunks_count": "Auto"}`

**DELETE** `/api/v1/knowledge/d1` — xoá tài liệu khỏi cả PocketBase lẫn AnythingLLM.

**`POST /api/v1/knowledge/sync`** — đồng bộ lại TOÀN BỘ tài liệu của tenant vào AnythingLLM (dùng khi nghi ngờ knowledge base bị lệch, ví dụ sau khi đổi workspace thủ công). Không cần body.

---

## `GET /api/v1/messages?session=xyz` — Đọc log chat

`session` (tuỳ chọn): lọc đúng 1 phiên. Bỏ trống = 100 tin nhắn mới nhất của toàn tenant.

```json
{
  "success": true,
  "messages": [
    { "id": "m1", "session": "abc", "username": "Khách", "text": "...", "is_bot": false, "needs_human": false, "created": "..." },
    { "id": "m2", "session": "abc", "username": "Trợ lý BĐS", "text": "...", "is_bot": true, "needs_human": true, "created": "..." }
  ]
}
```
`needs_human: true` = câu này AI trả lời không chắc chắn, đang chờ xử lý trong "Cần xử lý" ở `messages.html` (xem cơ chế Handoff).

---

## Ví dụ: tự động 100%, không cần mở dashboard

```bash
API_KEY="dán API key từ config.html"
BASE="https://apic.schoolsai.work"

# 1. Tạo bài + duyệt luôn (auto_approve), không cần ai bấm tay
curl -X POST "$BASE/api/v1/posts" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "title": "Khuyến mãi tháng 8",
    "content": "Nội dung khuyến mãi...",
    "image_url": "https://example.com/banner.jpg",
    "platforms": ["facebook"],
    "auto_approve": true
  }'

# 2. Đăng ngay, không chờ 15 phút
curl -X POST "$BASE/api/v1/trigger/publish" -H "Authorization: Bearer $API_KEY"

# 3. Kiểm tra kết quả
curl "$BASE/api/v1/status" -H "Authorization: Bearer $API_KEY"
```

---

## Toàn bộ endpoint theo nhóm

| Nhóm | Endpoint | Auth |
|---|---|---|
| Bài đăng social | `POST/GET /api/v1/posts`, `POST /api/v1/posts/:id/approve`, `GET /api/v1/status`, `POST /api/v1/trigger/rss-crawl`, `POST /api/v1/trigger/publish` | API key riêng tenant |
| Agent tự quyết định | `POST /api/v1/trigger/agent` | API key riêng tenant |
| Cụm bài blog dài chuẩn SEO (WordPress/Sanity) | `POST /api/v1/content-cluster` | API key riêng tenant |
| Lịch đăng bài tự động | `GET/POST /api/v1/schedules`, `PATCH/DELETE /api/v1/schedules/:id` | API key riêng tenant |
| Tạo link chat riêng cho khách (tích hợp POS...) | `POST /api/v1/chat-link` | API key riêng tenant |
| Chat với Trợ lý cấu hình | `POST /api/v1/agent-chat`, `GET /api/v1/agent-chat/tools` | API key riêng tenant |
| Chatbot | `POST /api/v1/chat` | API key riêng tenant |
| Cấu hình bot | `GET/PATCH /api/v1/config` | API key riêng tenant |
| Knowledge base | `GET/POST /api/v1/knowledge`, `DELETE /api/v1/knowledge/:id`, `POST /api/v1/knowledge/sync` | API key riêng tenant |
| Chat logs | `GET /api/v1/messages` | API key riêng tenant |
| Widget công khai (không dùng cho hệ thống ngoài) | `POST /chat`, `POST /embed`, `DELETE /doc`, `POST /sync-docs` | không — tenant tự khai trong body, dành cho widget nhúng công khai trên website khách, KHÔNG nên gọi trực tiếp các endpoint này từ hệ thống ngoài (dùng bản `/api/v1/*` tương ứng ở trên thay thế, có xác thực đàng hoàng) |
| Vận hành nội bộ (chỉ admin hệ thống) | `POST /run-digest`, `/run-rss-crawl`, `/run-publish-dispatch`, `/run-agent`, `/ping-anyllm` | header `X-Admin-Secret` = `ADMIN_SECRET` chung — chạy cho **TẤT CẢ** tenant cùng lúc |
| Khác | `GET /health` (không auth), `POST /telegram-webhook` (Telegram tự gọi) | — |

**Vì sao `/chat`, `/embed`... cũ vẫn còn tồn tại song song với `/api/v1/*` mới:** vì widget chat nhúng công khai trên website của khách hàng (không đăng nhập) vẫn cần gọi được — không thể bắt mọi khách ghé website phải có API key. `/api/v1/*` là lối vào riêng, có xác thực, dành cho **hệ thống backend** của bạn hoặc của khách hàng gọi vào, tách biệt hoàn toàn với đường widget công khai.

## Lưu ý triển khai

- Cần chạy `scripts/pb-migrate.mjs` (hoặc import `scripts/pb-import.json`) để có field `bot_configs.api_key` trước khi dùng.
- Tất cả input string đi vào PocketBase filter đều đã qua `escFilterValue()` để chống injection — không cần tự escape phía client.
- Chưa có rate limiting trên các endpoint `/api/v1/*` — nếu hệ thống ngoài gọi tần suất cao, cân nhắc thêm giới hạn ở tầng Cloudflare (Rate Limiting Rules) theo path `/api/v1/*`.
