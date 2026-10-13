# Bot tư vấn nền tảng (tenant `chatschoolai`)

Tenant riêng để Schools AI tự tư vấn cho chính nền tảng của mình, dùng 2 cấp trên cùng 1 bot:

| Cấp | Nơi đặt | Người dùng | Hành vi |
|---|---|---|---|
| **Cấp 1 — `public`** | Trang chủ (`landing.html`) | Khách tham quan | Giới thiệu tính năng, gói giá, so sánh, hướng dẫn đăng ký/dùng thử; không có dữ liệu riêng tư. |
| **Cấp 2 — `client`** | Mọi trang dashboard (qua `_shared/sidebar.js`) | Khách đã đăng nhập | Hướng dẫn thao tác từng màn hình, cấu hình, xử lý sự cố, hạn mức/billing; biết workspace đang dùng. |

Nguồn kiến thức: [USER_GUIDE.md](USER_GUIDE.md), [QUOTA.md](QUOTA.md), [API.md](API.md).

## Cách hoạt động

- Widget nhận `data-level="public|client"` (và `data-context` tuỳ chọn, tối đa 200 ký tự) rồi gửi `level`/`page_context` kèm `/chat`.
- Worker chỉ áp dụng phần bổ sung theo cấp cho tenant nền tảng (`PLATFORM_ADVISOR_TENANT`, mặc định `chatschoolai`); các tenant khác bỏ qua hai trường này.
- `level` chỉ chọn một đoạn hướng dẫn cố định trong mã; không cho phép truy cập dữ liệu. Thông tin ngữ cảnh từ trình duyệt luôn là gợi ý, không phải bằng chứng danh tính.

## Vận hành

- Cập nhật kiến thức: sửa `USER_GUIDE.md` → vào workspace `chatschoolai` → **Kiến Thức** → xoá tài liệu cũ, nạp bản mới.
- Hạn mức tin nhắn của bot trừ vào tài khoản chủ workspace `chatschoolai`; đặt hạn mức phù hợp vì trang chủ là public (đã có rate limit theo IP/tenant).
