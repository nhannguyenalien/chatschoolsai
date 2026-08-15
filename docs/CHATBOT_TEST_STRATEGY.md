# Chatbot test strategy

## Phạm vi ưu tiên

1. Chat runtime: input rỗng/sai kiểu/quá dài, lịch sử hội thoại, chặn client chèn role `system`, timeout và lỗi model.
2. Config: allowlist field, type/range validation, không đọc/ghi secret, không đổi tenant.
3. Training: thêm/list/xóa/sync, giới hạn payload, cô lập tenant, không xóa dữ liệu chéo tenant và giữ metadata để retry khi kho AI lỗi.
4. App Flutter: serialization an toàn, trạng thái loading/saving/error, validation form và refresh dữ liệu.

## Test tự động hiện có

- Worker unit/integration: auth, forced tenant, config redaction/validation (kể cả tool call), chat input boundaries, chống prompt-role injection, training payload, cross-tenant delete và retry-safe delete.
- Flutter unit: parse/serialize config, controller load/save/add/delete/sync, blank/oversized input và failure state.
- Flutter API contract: endpoint/payload của Agent Chat và Training, allowlist config, loại secret/tenant khỏi patch, mã hóa document ID.
- Flutter network: bearer header và ánh xạ an toàn lỗi auth, permission, rate limit, timeout, server.
- Flutter widget: xác nhận trước khi xóa training và chỉ cập nhật danh sách sau khi thao tác thành công.
- Flutter static analysis và toàn bộ widget/unit regression suite.

## Test cần chạy ở môi trường staging

- API key đúng/sai/hết hạn và hai tenant thật với tài liệu riêng biệt.
- Upload nội dung lớn, Unicode tiếng Việt, sync lại nhiều lần (idempotency), xóa khi AnythingLLM lỗi.
- Model trả tool call hợp lệ/sai JSON/nhiều tool call; xác nhận config DB thực sự thay đổi đúng tenant.
- iOS, Android, Windows: layout, bàn phím, mất mạng giữa thao tác và khôi phục sau khi mở lại app.

## Tiêu chí phát hành

- Không có lỗi analyze/test.
- Không secret hoặc tenant xuất hiện trong config patch.
- Mọi đường ghi/xóa đều xác thực API key và ép tenant từ server.
- Không mất danh sách training khi API mutation thất bại; người dùng thấy lỗi và có thể thử lại.
