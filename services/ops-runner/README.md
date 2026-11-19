# ops-runner

Việc nền chạy trên Coolify (Dell) cho những thứ Cloudflare Worker gói free không làm được. Node 22, không phụ thuộc thư viện.

## Quy tắc sống còn: chat KHÔNG được phụ thuộc runner

Chat khách (chatschoolsai), webhook Meta, đăng bài, đặt lịch chạy hoàn toàn trên **Cloudflare Worker + PocketBase**.
Worker **không bao giờ gọi** ops-runner. Coolify sập thì chỉ mất việc nền (backup, báo cáo, canh sống), khách vẫn chat bình thường.
Khi thêm job mới, giữ nguyên quy tắc này: runner chỉ *đọc/ghi PocketBase và báo Telegram*, không nằm trên đường đi của khách.

## Job

| Job | Lịch (giờ VN) | Việc |
|---|---|---|
| `watchdog` | mỗi 5 phút | Gọi PocketBase `/api/health` (+ `HEALTH_URLS`), báo Telegram khi hỏng 2 lần liền và khi hồi phục. Cũng giữ HF Space không ngủ |
| `pb-backup` | 03:00 | Tạo backup PocketBase, tải về `/data/backups`, xoá bản trên HF, giữ `BACKUP_KEEP_DAYS` ngày |
| `booking-digest` | 07:00 | Gửi chủ từng cơ sở lịch hôm nay + ngày mai (bỏ qua nếu không có lịch) |
| `weekly-report` | Thứ Hai 08:00 | Tin nhắn, lịch đặt, bài đăng 7 ngày qua |

Job lỡ giờ quá 3 tiếng (ví dụ container tắt cả buổi sáng) sẽ bỏ qua tới lần sau. Trạng thái lưu ở `/data/state.json` nên khởi động lại không gửi lặp.

## Biến môi trường

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASS` | có | Tài khoản superuser PocketBase |
| `TELEGRAM_BOT_TOKEN` | có | Cùng bot với Worker |
| `ALERT_CHAT_ID` | có | Chat của bạn, nhận cảnh báo hệ thống |
| `RUNNER_SECRET` | có | ≥16 ký tự, bảo vệ `/status` và `/run/:job` |
| `RUNNER_PORT` | không | Mặc định 3000 (không dùng `PORT` vì Coolify ghi đè) |
| `DATA_DIR` | không | Mặc định `/data` — **phải gắn volume** |
| `TZ_OFFSET_MIN` | không | Mặc định 420 (UTC+7) |
| `BACKUP_KEEP_DAYS` | không | Mặc định 14 |
| `HEALTH_URLS` | không | URL khác cần canh, ngăn cách bằng dấu phẩy |

## Triển khai trên Coolify

1. New Resource → Dockerfile → trỏ vào repo, **Base Directory** `services/ops-runner`.
2. Storage: thêm Persistent Volume gắn vào `/data`.
3. Điền biến môi trường ở trên; **chỉ 1 replica**.
4. Deploy. Kiểm tra:
   ```bash
   curl https://<domain>/health
   curl -H "Authorization: Bearer $RUNNER_SECRET" https://<domain>/status
   curl -X POST -H "Authorization: Bearer $RUNNER_SECRET" https://<domain>/run/pb-backup
   ```
5. Canh chính runner từ bên ngoài: tạo monitor miễn phí (UptimeRobot/BetterStack) vào `https://<domain>/health`, vì khi Coolify sập thì watchdog trong nó cũng im lặng.
6. Backup đang nằm cùng máy Dell. Nên đồng bộ thêm `/data/backups` ra ngoài (R2/Google Drive) ở bước sau.

## Phát triển

```bash
npm test
```
