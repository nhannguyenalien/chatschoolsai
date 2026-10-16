# Hướng dẫn khách: kết nối YouTube bằng project Google riêng

Mỗi khách dùng **một project Google Cloud riêng** để cấp quyền cho Schools AI đăng video và trả lời bình luận trên kênh của họ. Làm một lần, khoảng 10 phút. Không cần trả phí.

> Cần: tài khoản Google là **chủ kênh YouTube**, và kênh đã được tạo (đã có ít nhất một kênh trên youtube.com).

## Bước 1. Tạo project và bật YouTube API
1. Mở https://console.cloud.google.com/projectcreate → đặt tên (ví dụ `schoolsai-youtube`) → **Create**.
2. Mở https://console.cloud.google.com/apis/library/youtube.googleapis.com (đúng project vừa tạo) → **Enable**.

## Bước 2. Cấu hình màn hình đồng ý (Google Auth Platform)
1. Mở https://console.cloud.google.com/auth/overview/create → App name: tên bạn muốn (ví dụ tên doanh nghiệp), User support email và Contact email: email của bạn.
2. Audience: chọn **External**. Tick đồng ý chính sách dữ liệu → **Create**.
3. (Tuỳ chọn) Trang **Branding**: thêm homepage / privacy / terms của doanh nghiệp bạn nếu có.

## Bước 3. Tạo OAuth client
1. Mở https://console.cloud.google.com/auth/clients/create
2. Application type: **Web application**. Name: tuỳ ý.
3. **Authorized redirect URIs** → thêm đúng một dòng (sao chép nguyên văn, không thêm dấu `/` ở cuối):

   ```
   https://apic.schoolsai.work/api/youtube/callback
   ```

4. **Create**. Google hiện **Client ID** và **Client secret**: sao chép ngay (secret chỉ hiện một lần; mất thì tạo secret mới ở trang Clients).

## Bước 4. Publish app (quan trọng, 30 giây)
Mở https://console.cloud.google.com/auth/audience → **Publish app** → **Confirm**. Trạng thái phải là **In production**.

Vì sao nên làm:
| | Để ở Testing | Đã Publish (In production) |
|---|---|---|
| Hạn token | Hết hạn sau **7 ngày** (phải kết nối lại mỗi tuần) | **Không** hết hạn sau 7 ngày |
| Cần thêm email vào Test users | Có | Không |
| Màn hình cấp quyền | Bình thường | Có cảnh báo "Google hasn't verified this app" (xem bước 5) |
| Người dùng tối đa | 100 | 100 (chưa xác minh) |

Mỗi khách chỉ cần 1–2 tài khoản nên giới hạn 100 không ảnh hưởng.

## Bước 5. Kết nối trong Schools AI
1. Vào dashboard → **Cấu hình kênh** (`sm-config`) → **Kết nối YouTube**.
2. Dán **Client ID** và **Client Secret** từ bước 3.
3. Chọn **Chế độ video khi đăng** (Công khai / Không công khai / Riêng tư) và bật hoặc tắt **Bot tự trả lời bình luận**.
4. Bấm **Tiếp tục với Google** → chọn tài khoản chủ kênh.
5. Nếu thấy **"Google hasn't verified this app"**: bấm **Advanced** → **Go to … (unsafe)**. Đây là app của chính bạn nên an toàn; màn hình này chỉ biến mất khi Google xác minh app.
6. Tick đủ các quyền được hỏi (đăng video, xem kênh, quản lý bình luận) → **Continue**. Hệ thống đưa bạn về `sm-config` và báo đã kết nối.

> Tài khoản Google có nhiều kênh (Brand Account): chọn đúng kênh khi Google hỏi. Muốn kết nối kênh khác thì lặp lại bước 5.

## Giới hạn cần biết
| Giới hạn | Mức | Ghi chú |
|---|---|---|
| Hạn mức YouTube API | 10.000 đơn vị/ngày **mỗi project** (của riêng bạn, không chia với khách khác) | Mỗi video đăng ≈ 1.600 đơn vị (≈ 6 video/ngày). Bot bình luận: quét ≈ 100 đơn vị/ngày, mỗi câu trả lời 50 đơn vị. |
| **Video public** | Project chưa qua *YouTube API audit* bị YouTube **khóa video ở Private** dù chọn Public | Bài vẫn báo thành công, có ghi chú "đang ở private thay vì public". Đổi thủ công trong YouTube Studio, hoặc nộp audit (bên dưới). |
| Người dùng mỗi project | 100 khi chưa xác minh | Đủ cho dùng riêng. |
| Bot bình luận | Tối đa 3 câu/kênh mỗi 15 phút | Chỉ trả lời bình luận mới từ lúc kết nối, bỏ qua bình luận có link và bình luận cũ hơn 24 giờ. |

## Muốn đăng public ổn định: nộp YouTube API audit
1. Hoàn tất bước 1–5 và đăng thử vài video.
2. Điền form: https://support.google.com/youtube/contact/yt_api_form (mục *Audit and Quota Extension*).
3. Nội dung gợi ý: project dùng để đăng video của chính chủ kênh và trả lời bình luận qua Schools AI; chỉ truy cập kênh của chủ project; tuân thủ YouTube API Services Terms. Đính kèm video quay màn hình: kết nối kênh → đăng video → xem trong YouTube Studio → bot trả lời bình luận.
4. Thường mất vài tuần. Trong lúc chờ, video lên ở chế độ private như trên.

## Khi cần kết nối lại
- Token bị thu hồi (bạn gỡ quyền ở https://myaccount.google.com/permissions), hoặc project để ở Testing quá 7 ngày: vào **Kết nối YouTube** → chọn kênh trong danh sách → để trống Client ID/Secret (dùng lại cái đã lưu) → **Tiếp tục với Google**.
- Nếu bot báo qua Telegram "kênh thiếu quyền": làm đúng như trên một lần.
- Muốn ngừng: tắt ô "Bot tự trả lời bình luận" hoặc xoá kênh trong **Cấu hình kênh**, và gỡ quyền ở trang permissions của Google.

## Xử lý lỗi thường gặp
| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI ở bước 3 sai hoặc thừa ký tự | Sửa đúng `https://apic.schoolsai.work/api/youtube/callback` rồi đợi vài phút |
| `Error 403: access_denied` / "app not verified … test users" | App còn ở Testing và email chưa vào Test users | Làm bước 4 (Publish app), hoặc thêm email vào Test users ở trang Audience |
| "Google không cấp refresh token" | Quyền cũ còn lưu ở Google | Gỡ quyền của app ở myaccount.google.com/permissions rồi kết nối lại |
| "Tài khoản Google này chưa có kênh YouTube" | Chưa tạo kênh | Tạo kênh trên youtube.com rồi kết nối lại |
| Video đăng xong nhưng ở private | Project chưa qua audit | Xem mục "Muốn đăng public ổn định" |
