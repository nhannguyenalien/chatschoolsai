# Schools AI — Hướng dẫn sử dụng toàn diện

Tài liệu này dành cho khách hàng (chủ tài khoản / quản trị workspace) và cũng được nạp làm kho kiến thức cho bot tư vấn `chatschoolai` (xem [PLATFORM_ADVISOR.md](PLATFORM_ADVISOR.md)). Nội dung bám theo bản dashboard hiện tại tại https://chat.schoolsai.work.

---

## 1. Schools AI là gì?

Schools AI là nền tảng cho phép bạn tạo trợ lý AI chăm sóc khách hàng và tạo nội dung cho doanh nghiệp, gồm:

- **Hội thoại có ngữ cảnh**: bot trả lời từ kho kiến thức của bạn, nhớ ngữ cảnh khách, chuyển cho nhân viên khi không chắc chắn.
- **Nói chuyện với AI**: hội thoại giọng nói theo từng lượt; gọi trực tiếp giữa nhân viên và khách.
- **Nội dung mạng xã hội**: soạn bài, duyệt, đăng lên Facebook/Instagram…, kế hoạch nội dung theo tuần.
- **Tích điểm khách hàng** (loyalty).
- **Kết nối**: Messenger, Instagram, WhatsApp, Telegram, Zalo, WordPress, Sanity, API/MCP riêng của bạn.
- **Ứng dụng**: web dashboard và app client (Android, Windows, macOS).

Giao diện hỗ trợ 6 ngôn ngữ: Tiếng Việt, English, 日本語, Español, Français, 한국어 (đổi ở thanh bên dưới cùng).

## 2. Khái niệm cơ bản

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Tài khoản (account)** | Đăng nhập bằng email + mật khẩu hoặc Google. Gói (Free/Pro), hạn mức tin nhắn và dung lượng lưu trữ tính theo tài khoản, dùng chung mọi workspace. |
| **Workspace / tenant** | Một bot riêng với cấu hình, kiến thức, kênh kết nối, khách hàng và điểm thưởng tách biệt. Mỗi workspace có mã (slug) 3–40 ký tự gồm chữ thường, số, `-`, `_`; **không đổi được sau khi tạo**. |
| **Gói Free** | Tối đa 3 workspace, 100 tin nhắn/tháng, 100 MB lưu trữ ảnh/video. |
| **Gói Pro** | Tối đa 10 workspace, 1.000 tin nhắn/tháng, 2 GB lưu trữ. Có thể mua thêm gói tin nhắn bổ sung. |

Mỗi lần bot trả lời 1 tin nhắn = 1 đơn vị. Các thao tác khác tốn nhiều đơn vị hơn: viết bài 2, ảnh AI 8, hội thoại giọng nói 4/phút, nạp tài liệu `ceil(token/5000)` (tối thiểu 1, tối đa 20/tài liệu). Hạn mức reset theo tháng UTC. Hết hạn mức bot ngừng trả lời (HTTP 429) cho đến khi nâng gói/mua thêm.

## 3. Bắt đầu nhanh (10 phút)

1. **Đăng nhập** tại https://chat.schoolsai.work (hoặc đăng ký tài khoản mới; app client cũng có màn đăng ký).
2. Chọn hoặc tạo **workspace** (nút **+ Thêm mới** ở thanh bên, hoặc *Tài khoản → Không gian làm việc*). Nhập **Tên bot** và **Mã workspace**.
   - Lưu ý: ô mã tự điền theo tên bot; nếu sửa mã, hãy **xoá hết nội dung ô mã rồi gõ lại** để không bị nối chuỗi.
3. Vào **Cài Đặt Bot**: đặt tên, avatar, màu, lời chào, ngôn ngữ trả lời, System Instructions.
4. Vào **Kiến Thức**: nạp tài liệu (FAQ, bảng giá, chính sách, mô tả sản phẩm).
5. Vào **Nhúng Widget**: chọn giao diện, copy đoạn `<script>` dán vào website, hoặc kết nối Messenger/Instagram/Telegram ở **Cấu Hình Kênh**.
6. Dùng **Xem như khách hàng** để thử trước như một khách thật, rồi theo dõi ở **Nhật Ký Chat**.

## 4. Các màn hình trong dashboard

### 4.1 Overview
Tổng quan workspace: số tin nhắn, số hội thoại, thông tin bot, trạng thái hạn mức. Có biểu đồ hoạt động.

### 4.2 Cài Đặt Bot
- **Tên bot, Avatar (emoji), Màu chủ đạo, Tin nhắn chào.**
- **Tenant ID**: mã workspace (chỉ đọc).
- **Ngôn ngữ trả lời**: tự nhận theo khách, hoặc cố định vi/en/ja/es/fr/ko.
- **System Instructions (Prompt)**: vai trò, giọng điệu, quy tắc bot phải theo. Nên viết rõ: bot là ai, được/không được nói gì, khi nào chuyển cho nhân viên.
- **Temperature**: thấp (0.1–0.3) cho câu trả lời bám tài liệu; cao hơn cho văn phong sáng tạo.
- **Telegram Chat ID nhận cảnh báo**: khi AI không chắc chắn, bot gửi cảnh báo kèm link trả lời tại Nhật Ký Chat.
- **Dữ liệu thật của bạn (tool)**: khai báo MCP server hoặc tool GET (ví dụ WooCommerce Store API, tra đơn hàng) để bot tra dữ liệu thật khi trả lời; có template WooCommerce tạo sẵn tool tìm sản phẩm/danh mục từ tên miền shop.
- **Ảnh & thương hiệu**: logo, chữ đóng dấu lên ảnh trước khi đăng (vị trí, kích thước, độ đậm, viền); nguồn ảnh; phong cách ảnh AI; **PixVerse API Key** riêng nếu muốn sinh video (chi phí tính trên tài khoản PixVerse của bạn).
- **API Key** cho hệ thống ngoài: tạo/đổi mới tại đây (xem mục 8).

### 4.3 Nhúng Widget
Tạo đoạn mã nhúng chat vào website. Tuỳ chọn: **template, màu, vị trí (trái/phải), kiểu hiển thị (bong bóng nổi hoặc thanh bên cố định), bo góc, ngôn ngữ giao diện widget, tên miền được phép**. Có xem trước trực tiếp. Mẫu mã:

```html
<script src="https://chat.schoolsai.work/chat-widget.js"
        data-tenant="MA_WORKSPACE" data-botname="Tên bot"
        data-color="#0050cb" data-position="right"
        data-style="bubble" data-lang="vi"></script>
```

Khi đặt `data-domain`, widget chỉ chạy trên tên miền đó (localhost vẫn chạy để bạn thử).

### 4.4 Chat với Agent
Trò chuyện với **agent vận hành** của workspace để thực hiện công việc bằng ngôn ngữ tự nhiên (hỏi số liệu, soạn nội dung, lên kế hoạch…) thay vì bấm từng màn hình.

### 4.5 Kiến Thức
Nạp tài liệu để bot trả lời đúng: dán văn bản hoặc tải tệp; mỗi tài liệu hiện thành một dòng (tiêu đề, số ký tự, ngày). Nên dùng nhiều tài liệu ngắn theo chủ đề thay vì 1 tài liệu khổng lồ. Link ảnh/video (YouTube/Vimeo/mp4) trong mô tả sản phẩm sẽ được bot gửi kèm khi khách xin xem hình. Nạp tài liệu tốn hạn mức (mục 2). Sau khi sửa nội dung gốc, hãy xoá tài liệu cũ và nạp lại bản mới.

### 4.6 Nhật Ký Chat
Xem mọi hội thoại theo từng phiên khách: tin khách, tin bot, thiết bị/vị trí, cờ **cần người** (`needs_human`). Bạn có thể **trả lời trực tiếp** thay bot; trang tự cập nhật khi đang mở.

### 4.7 Xem như khách hàng
Cổng dành cho khách của bạn (đăng nhập bằng cổng khách), giúp kiểm tra trải nghiệm đúng như khách thấy.

### 4.8 Mạng xã hội
- **Bài Đăng**: danh sách bài và trạng thái từng kênh (pending → approved → published/failed). Bài được duyệt sẽ đăng tự động trong tối đa ~15 phút.
- **Soạn Bài**: viết tay hoặc nhờ AI; gắn ảnh/video; chọn kênh; đặt lịch; duyệt.
- **Analytics**: hiệu suất bài đăng, gợi ý chủ đề; nối Google Analytics/Search Console và Facebook Insights khi đã cấp quyền.
- **Cấu Hình Kênh**: kết nối Facebook/Instagram (page, token), WordPress, Sanity… Kênh nào chưa cấu hình sẽ bị bỏ qua khi đăng.
- **Kế hoạch nội dung tuần**: hệ thống có thể tự lập kế hoạch theo lịch/tần suất bạn chọn, bạn duyệt hoặc từ chối từng mục (kể cả duyệt qua Telegram nếu đã kết nối).

### 4.9 Tài khoản (dùng chung mọi workspace)
- **Thanh Toán**: xem gói, nâng Pro tháng (19 USD) hoặc năm (199 USD), mua thêm 1.000 tin nhắn (7 USD, một lần). Thanh toán qua cổng BGate/Whop; giá do máy chủ quy định.
- **Agent tổng (mọi tenant)**: một agent làm việc trên tất cả workspace của bạn.
- **Thông tin tài khoản**: đổi mật khẩu, xem dung lượng lưu trữ, danh sách và hạn mức workspace, tạo workspace mới.
- **API Docs**: tài liệu API đầy đủ tại https://apic.schoolsai.work/docs.

Thanh bên dưới cùng: đổi **ngôn ngữ**, đăng xuất. Đổi workspace bằng danh sách "Workspace đang dùng" ở đầu thanh bên.

## 5. Kênh kết nối

| Kênh | Cách dùng |
|---|---|
| Website | Dán mã widget (mục 4.3). |
| Messenger / Instagram / WhatsApp / Telegram | Cấu hình ở **Cấu Hình Kênh**; bot trả lời trong kênh và tự chuyển markdown thành văn bản thuần phù hợp từng kênh. |
| Zalo | Kết nối qua cấu hình kênh/webhook. |
| WordPress / Sanity | Đăng blog/bài viết tự động từ Soạn Bài. |
| API / MCP | Hệ thống ngoài gọi vào bằng API key; bot gọi ra MCP/tool GET của bạn để lấy dữ liệu thật. |

## 6. Gọi thoại và hội thoại giọng nói

- Khách có thể nói chuyện với AI theo từng lượt (nhận giọng → trả lời bằng giọng).
- Nhân viên và khách có thể gọi trực tiếp (WebRTC) trong widget/app; cuộc gọi đến hiện thông báo trong app client và có chuông.
- Giới hạn thời lượng nói chuyện với AI theo ngày để kiểm soát chi phí.

## 7. Ứng dụng client (Android / Windows / macOS)

Ứng dụng đăng nhập bằng email/mật khẩu hoặc Google, gồm: tổng quan, chat với agent, chatbot (cấu hình + kiến thức), tin nhắn, bài đăng, trung tâm nội dung, thanh toán, tích điểm và cuộc gọi. Android, Windows, macOS cập nhật nhanh qua OTA; bản iOS đang chờ hoàn tất ký số.

## 8. API cho hệ thống ngoài

Mỗi workspace có 1 **API key** (Cài Đặt Bot → API Key → Tạo/Đổi mới). Gửi `Authorization: Bearer <API_KEY>`. Một số endpoint:

- `POST /api/onboarding/register` — tạo tài khoản + bot đầu tiên.
- `POST /api/v1/bots` — tạo thêm bot.
- `POST /api/v1/posts` — bơm bài viết vào luồng đăng (`title`, `content`, `platforms`, `auto_approve`…).
- `PUT /api/v1/customer-context` — gắn thông tin khách vào phiên chat để bot cá nhân hoá.
- Chat, voice, lessons, loyalty, workspaces: xem https://apic.schoolsai.work/docs và [API.md](API.md).

Không đưa API key vào mã chạy trên trình duyệt công khai. Đổi mới key ngay nếu bị lộ.

## 9. Viết bot tốt (mẹo)

1. **System Instructions** ngắn gọn, có cấu trúc: vai trò → phạm vi → giọng điệu → những điều không được làm → khi nào chuyển người.
2. **Kiến thức** ưu tiên dữ kiện cụ thể (giá, giờ mở cửa, chính sách đổi trả). Bot chỉ nên trả lời trong phạm vi tài liệu; yêu cầu nó nói "không biết" thay vì đoán.
3. Dùng **Temperature thấp** cho bot hỗ trợ.
4. Thử bằng **Xem như khách hàng**, đọc **Nhật Ký Chat** hằng tuần, bổ sung tài liệu cho các câu bot trả lời sai/chưa chắc chắn.
5. Bật **Telegram cảnh báo** để không bỏ lỡ khách cần người thật.
6. Đặt **tên miền được phép** cho widget để tránh bị nhúng trộm.

## 10. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân/cách xử lý |
|---|---|
| Bot trả lời "để mình nhờ admin hỗ trợ" | AI không chắc hoặc lỗi nhà cung cấp; kiểm tra Nhật Ký Chat, bổ sung kiến thức. |
| Bot ngừng trả lời, lỗi 429 | Hết hạn mức tin nhắn tháng hoặc bị giới hạn tốc độ; nâng Pro/mua thêm tin nhắn. |
| Widget không hiện | Sai `data-tenant`, hoặc tên miền không khớp `data-domain`; xem Console trình duyệt. |
| Không tạo được workspace | Đã đạt giới hạn (Free 3, Pro 10) hoặc mã đã dùng/không hợp lệ. |
| Bài không đăng | Kênh chưa cấu hình hoặc token hết hạn; bài chưa ở trạng thái approved. |
| Không nạp được tài liệu | Hết hạn mức, tài liệu quá dài/rỗng; chia nhỏ và nạp lại. |

## 11. Hỏi đáp nhanh

- **Có đổi được mã workspace không?** Không. Hãy tạo workspace mới.
- **Một tài khoản có nhiều bot không?** Có — mỗi workspace một bot (Free 3, Pro 10).
- **Dữ liệu của workspace này có lẫn sang workspace khác không?** Không, tách biệt hoàn toàn.
- **Khách dùng ngôn ngữ khác thì sao?** Để "tự nhận ngôn ngữ" hoặc cố định ngôn ngữ trả lời trong Cài Đặt Bot.
- **Dùng bot trên nhiều kênh cùng lúc được không?** Được: website, Messenger, Instagram, WhatsApp, Telegram dùng chung kiến thức của workspace.
- **Hỗ trợ ở đâu?** Hỏi ngay bot tư vấn Schools AI (bong bóng chat ở trang chủ và trong dashboard).
