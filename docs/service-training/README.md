# Bot tư vấn dịch vụ Setup theo từng nước (VN, ID, PH)

Cập nhật 2026-11-10. Mỗi nước một workspace (tenant) riêng, đều thuộc tài khoản Pro của chủ hệ thống.

| Workspace (slug) | Nước | Ngôn ngữ prompt | Knowledge |
|---|---|---|---|
| `schoolsai-vn` | Việt Nam (VND) | Tiếng Việt | Gói và chính sách; Schools AI là gì và gói tự dùng |
| `schoolsai-id` | Indonesia (Rupiah) | Tiếng Indonesia | Paket dan kebijakan; Apa itu Schools AI dan paket swalayan |
| `schoolsai-ph` | Philippines (peso) | Tiếng Anh | Packages and policies; What is Schools AI and self-serve plans |

Nội dung knowledge và system prompt nằm trên dashboard của từng workspace (knowledge.html, config.html), đó là bản mới nhất. Các file `vi.md`, `id.md`, `en-ph.md` trong thư mục này là bản nháp ban đầu của tài liệu gói dịch vụ (trước khi tách tenant); bảng giá trong đó vẫn đúng.

Giá (Setup / Managed mỗi tháng / Growth mỗi tháng):
- VN: 2.500.000đ / 890.000đ / 2.290.000đ
- ID: Rp1.650.000 / Rp550.000 / Rp1.450.000
- PH: ₱5,800 / ₱1,950 / ₱4,900

Cấu hình bot: nhiệt độ (temperature) 0.3 cho chính xác; prompt viết bằng ngôn ngữ của nước đó để tránh lẫn chữ Việt. Prompt có quy tắc: chỉ báo giá nước mình, nước khác thì không báo giá nào; điều chưa quyết định thì "nhân viên xác nhận"; chỉ xin liên hệ khi khách muốn tiếp tục.

## `chatschoolai` (bot hỗ trợ sản phẩm)
Đã khôi phục như ban đầu: xóa 4 tài liệu dịch vụ đã thêm, trả system prompt về bản gốc (1.240 ký tự). Một thay đổi giữ lại có chủ ý: tài liệu "Tổng quan, khái niệm và gói giá" sửa "Pro tối đa 10 workspace" thành 50 (đúng theo code `WORKSPACE_LIMITS` và trang tài khoản); `docs/USER_GUIDE.md` cũng đã sửa.

## Chưa có quyết định kinh doanh (bot đang trả lời "nhân viên xác nhận")
Hoàn tiền; nhiều chi nhánh; Managed có bắt buộc không; giới hạn tin nhắn từng gói; dùng thử miễn phí dịch vụ Setup; giá thêm kênh chat; công nghệ AI, nơi lưu dữ liệu, bảo mật; phương thức thanh toán; hợp đồng và hóa đơn VAT; giao nhanh hơn 3 đến 5 ngày làm việc.

## Kết quả test (khoảng 70 tình huống, nhiều lượt)
Đã kiểm tra giá 3 gói, 1 kênh chat, thời gian giao, hủy, trả theo năm, các điều chưa quyết định, giảm giá, hứa doanh thu, so sánh đối thủ, Zalo/WhatsApp/GCash, OTP, prompt injection, khách nước khác, USD, gói tự dùng Pro, hội thoại chốt khách nhiều lượt, ngôn ngữ (Anh, Tagalog). Sau khi chỉnh prompt lần cuối, 12 câu kiểm tra lại đều đạt. Không còn lẫn chữ Việt trong câu trả lời Indonesia.

Lưu ý: câu trả lời AI không cố định mỗi lần; nên đọc hội thoại thật hàng ngày trong tuần đầu chạy quảng cáo. Các câu test đã vào thống kê hội thoại của 3 tenant mới.

Còn sót "Pro tối đa 10 workspace" trong `marketing/social/plan_cs.py` và `marketing/social/src/cards.json` (chưa sửa).
