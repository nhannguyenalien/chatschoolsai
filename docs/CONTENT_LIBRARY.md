# Kho nội dung (Content Library)

Agent hoặc người dùng lưu bài vào kho. Nền tảng chưa có API đăng tự động thì nhân viên đăng tay, dán link, chủ vào kiểm tra.

## Luồng

`todo` (chờ đăng) → `done` (đã đăng, chờ kiểm tra) → `approved` (đạt) hoặc `redo` (làm lại, bắt buộc ghi lý do) → `done` …

Mỗi nội dung có một hay nhiều "nơi đăng" (task); mỗi nơi đăng có trạng thái và link riêng. Hoàn thành bắt buộc có link http(s).
Kho nội dung không tự đăng bài: bài cần đăng tự động lên Facebook Page / blog vẫn dùng Soạn bài và Lịch đăng bài.

## Quyền

| Ai | Vào đâu | Làm được |
|---|---|---|
| owner, admin | `content-library.html` | mọi thao tác, duyệt, trả lại, xoá, tạo/thu hồi link nhân viên |
| editor | `content-library.html` | thêm, sửa, đánh dấu đã đăng; không duyệt, không xoá nội dung |
| viewer | `content-library.html` | chỉ xem |
| nhân viên (link) | `content-staff.html#<mã>` | xem việc cần đăng và việc mình đã làm, đánh dấu đã đăng, bỏ đánh dấu khi chưa duyệt |
| agent (API key) | `/api/v1/content-library` | lưu bài, đọc trạng thái, báo link; không duyệt |

Link nhân viên không cần tài khoản. Mã nằm sau `#` (không gửi lên máy chủ trong URL), kho chỉ lưu bản băm SHA-256, link hiện một lần và thu hồi được.
Ai cầm link đều dùng được, nên tên "người đăng" là tên gắn với link, không phải danh tính đã xác thực.
`content-staff.html` không được thêm analytics hay script bên thứ ba.

## API

Xem mục "Kho nội dung" ở `https://apic.schoolsai.work/docs`, hoặc nút **API cho agent** trên dashboard.

| Route | Xác thực |
|---|---|
| `/api/account/content-library…?tenant=` | token đăng nhập dashboard |
| `/api/content-staff…` | `Bearer <mã trong link>` |
| `/api/v1/content-library…` | `Bearer <API key workspace>` |

## Dữ liệu

`content_items`, `content_tasks`, `content_staff` (định nghĩa ở `scripts/pb-content-library-schema.mjs`). Không có API rule công khai.
Worker tự tạo collection ở lần gọi đầu tiên. Xoá nội dung không xoá file trong thư viện media.

## Phát hành

1. `cd worker-chat-d/knowledge-worker && npx wrangler deploy`
2. Deploy `dash-tabler/` lên Cloudflare Pages.

Giới hạn hiện tại: mỗi workspace đọc tối đa 2.000 bản ghi mỗi loại; giao diện kho chỉ có tiếng Việt và tiếng Anh; chưa có thông báo Telegram khi nhân viên gửi bài.
