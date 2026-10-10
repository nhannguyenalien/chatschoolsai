# Cron tự tạo kế hoạch tuần (chạy trên VPS Coolify)

Worker không tự chạy việc này bằng cron của Cloudflare. Một cron **mỗi giờ** trên VPS gọi vào worker; worker tự quyết tenant nào
đến lượt (đúng thứ + giờ đã chọn trong tab "Kế hoạch tuần", theo múi giờ của tenant, chưa có kế hoạch trong 5 ngày qua, kế hoạch
trước đã duyệt xong). Gọi dư không sao — không đến lượt thì worker không làm gì và không tốn lượt AI.

## Lệnh cron (mỗi giờ, phút 0)

Biểu thức: `0 * * * *`

```bash
curl -fsS -X POST https://apic.schoolsai.work/run-weekly-plan -H "X-Admin-Secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{}'
```

Container Alpine không có `curl` thì dùng `wget`:

```bash
wget -qO- --header="X-Admin-Secret: $ADMIN_SECRET" --header="Content-Type: application/json" --post-data='{}' https://apic.schoolsai.work/run-weekly-plan
```

Kết quả đúng: `{"ok":true}`. Sai secret: `401 {"error":"Unauthorized"}`.

## Cài trên Coolify

- Đặt `ADMIN_SECRET` làm biến môi trường (Environment Variables) của ứng dụng/dịch vụ — đừng ghi thẳng secret vào lệnh.
- **Cách 1:** ứng dụng đang có sẵn trên Coolify → tab **Scheduled Tasks** → Add → Frequency `0 * * * *` → dán lệnh trên
  (lệnh chạy bên trong container của ứng dụng đó nên container cần có `curl` hoặc `wget`).
- **Cách 2:** tạo 1 dịch vụ nhỏ riêng (image `alpine`/`curlimages/curl`) chỉ để chạy cron, thêm Scheduled Task như trên.

## Chạy thử cho 1 tenant ngay (bỏ qua điều kiện thứ/giờ)

Tenant phải đang bật "Tự động tạo kế hoạch mỗi tuần". Chỉ tạo bản nháp chờ duyệt, không đăng.

```bash
curl -X POST https://apic.schoolsai.work/run-weekly-plan -H "X-Admin-Secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"tenant":"<tenant>","force":true}'
```
