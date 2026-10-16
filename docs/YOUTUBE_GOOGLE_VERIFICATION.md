# Xin Google xác minh app YouTube (để đăng video public)

Hai việc **khác nhau** cùng cần làm cho mỗi Google Cloud project dùng để kết nối YouTube:

| | Xác minh OAuth (OAuth verification) | YouTube API Services audit |
|---|---|---|
| Để làm gì | Bỏ cảnh báo "app chưa xác minh", bỏ giới hạn 100 người dùng và hạn 7 ngày của refresh token | Cho phép video đăng qua API ở chế độ **public** (nếu chưa audit, YouTube tự khoá video ở private) |
| Nơi nộp | Google Cloud Console → Google Auth Platform → Verification Center | Form "YouTube API Services – Audit and Quota Extension" (https://support.google.com/youtube/contact/yt_api_form) |
| Thời gian | vài ngày đến vài tuần | vài tuần |

Mỗi tenant tự dùng project Google riêng nên mỗi project phải làm hai bước này. Project `dashpoc-youtube` của chủ hệ thống là mẫu.

## 0. Điều kiện đã có sẵn trong code
- Trang chủ công khai: `https://chat.schoolsai.work/landing` (mô tả sản phẩm, có liên kết chính sách ở chân trang).
- Chính sách quyền riêng tư: `https://chat.schoolsai.work/privacy` (có đoạn **Limited Use**, quyền xin, cách thu hồi/xoá dữ liệu, thông báo gửi bình luận tới nhà cung cấp AI).
- Điều khoản: `https://chat.schoolsai.work/terms`.
- Phải **deploy dashboard** (Cloudflare Pages) để các trang trên truy cập được trước khi nộp.

## 1. Cấu hình Branding (Google Auth Platform → Branding)
- App name: `Schools AI` · User support email: email của bạn · Developer contact: email của bạn.
- App domain: homepage `https://chat.schoolsai.work/landing`, privacy `https://chat.schoolsai.work/privacy`, terms `https://chat.schoolsai.work/terms`.
- Authorized domains: `schoolsai.work` (**phải xác minh quyền sở hữu domain trong Google Search Console** bằng tài khoản có quyền owner/editor của project; cách dễ nhất là bản ghi TXT DNS ở Cloudflare).
- Logo (tuỳ chọn nhưng nên có, 120x120 PNG).

## 2. Khai báo scope (Google Auth Platform → Data Access)
Thêm 3 scope (đều là *sensitive*):
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.force-ssl`

Lời giải trình dán vào ô justification (tiếng Anh):

> **youtube.upload** — Schools AI lets a business publish videos it owns to its own YouTube channel from a content calendar. The scope is used only to upload videos that the signed-in channel owner submits, with the title, description and visibility the owner selects.
>
> **youtube.readonly** — Used only to read the channel ID and channel name after sign-in, so the dashboard can show which channel is connected and where to publish.
>
> **youtube.force-ssl** — Used only (a) to read comments on the owner's channel videos and (b) to post replies from the owner's own channel when the owner has switched on the "bot replies to comments" option. The owner can turn this off at any time and can revoke access at myaccount.google.com/permissions.

## 3. Video demo (bắt buộc, do bạn quay)
Quay 1 video (3–5 phút, đăng YouTube chế độ *Unlisted*, giọng nói hoặc phụ đề tiếng Anh), giao diện tiếng Anh, thấy rõ thanh địa chỉ. Nội dung theo thứ tự:
1. Trang chủ + trang Privacy Policy (có nhắc Google API Limited Use).
2. Vào `Channel Settings` → bấm **Connect YouTube**.
3. Màn hình đồng ý của Google: hiện **Client ID/tên app và danh sách quyền** (zoom vào từng quyền), bấm Allow.
4. Quay lại dashboard thấy kênh đã kết nối.
5. Đăng một video từ Composer (hoặc API) → mở YouTube Studio thấy video đã lên với đúng tiêu đề/mô tả.
6. Bình luận một câu dưới video bằng tài khoản khác → chờ bot trả lời → hiện câu trả lời trên YouTube.
7. Cho thấy cách ngắt kết nối và thu hồi quyền ở myaccount.google.com/permissions.

## 4. Nộp
- Verification Center → **Submit for verification**, dán link video, trả lời các câu hỏi (mục đích sử dụng từng scope như phần 2).
- Sau khi OAuth được duyệt, nộp form YouTube API audit: nêu dự án, link video demo, mô tả luồng, xác nhận tuân thủ YouTube API Services Terms. Trong lúc chờ, video vẫn đăng được nhưng sẽ bị khoá private (hệ thống ghi chú vào `error_log` của bài).

## 5. Lưu ý khi chờ
- Có hai trạng thái app trong Google Auth Platform → Audience:
  - **Testing**: chỉ *Test users* đăng nhập được, refresh token hết hạn sau **7 ngày** → kênh phải kết nối lại hằng tuần.
  - **In production** (nút *Publish app* → Confirm): **không cần duyệt để chuyển**. Token cấp mới không còn hết hạn sau 7 ngày, không cần Test users. Đổi lại người dùng thấy màn hình "Google hasn't verified this app" (bấm *Advanced* → *Go to … (unsafe)*) và giới hạn 100 người dùng cho tới khi app được xác minh. Project `dashpoc-youtube` đã chuyển sang trạng thái này ngày 16/10/2026.
- Token cấp **trước khi** Publish vẫn theo luật 7 ngày → kết nối lại một lần để lấy token mới.
- Verification Center chỉ cho nộp xác minh khi app đã In production.
- Hướng dẫn từng bước cho khách tự làm (cách mỗi khách một project): xem `docs/YOUTUBE_CUSTOMER_SETUP.md`.
