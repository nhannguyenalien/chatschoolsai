# youtube-uploader

Service nhỏ (Node 22, không phụ thuộc thư viện) chạy trên VPS để đẩy video lên YouTube cho Worker Cloudflare.

- `POST /upload` — header `Authorization: Bearer $UPLOADER_SECRET`, body `{ video_url, access_token, metadata }` → `{ video_id }`.
- `GET /health` — kiểm tra sống.
- Biến môi trường: `UPLOADER_SECRET` (≥16 ký tự, bắt buộc, trùng `YT_UPLOADER_SECRET` của Worker), `UPLOADER_PORT` (3000; không dùng `PORT` vì Coolify tự ghi đè), `MAX_VIDEO_BYTES` (mặc định 5GB).
- Chỉ nhận `video_url` https công khai (chặn địa chỉ nội bộ), stream trực tiếp nguồn → YouTube, tối đa 2 upload đồng thời.
- Test: `npm test`.
