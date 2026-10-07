# Media storage

Ảnh/video của tenant (ảnh AI, video PixVerse, file khách upload ở composer) đi qua
`createMediaStore` (`worker-chat-d/knowledge-worker/src/domain/media/mediaStore.js`).

## Hạn mức

| Gói | Dung lượng |
|---|---|
| free | 100 MB |
| pro | 2 GB |

- Tính theo **tài khoản** (chung cho mọi workspace), không reset theo tháng.
- Override: field `storage_limit_bytes` trên record `tenants` (0 hoặc trống = dùng mặc định theo gói).
- Bộ đếm `tenants.storage_used` (byte) do `AccountQuota` Durable Object ghi (cùng DO với quota tin nhắn, nên
  upload song song không vượt hạn mức). Giữ chỗ trước khi ghi, hoàn trả nếu ghi lỗi hoặc khi xoá.
- Giới hạn mỗi file: ảnh 15 MB, video 200 MB. Định dạng: png/jpg/webp/gif/svg, mp4/webm/mov.
- Hết dung lượng: HTTP 413, `error.code = STORAGE_QUOTA_EXCEEDED`. Ảnh AI hết dung lượng thì bài vẫn tạo
  (không có ảnh); video PixVerse thì gắn link gốc của PixVerse (link tạm).

## Backend

- Có binding `MEDIA_BUCKET` (R2): object key `{tenant}/{yyyy-mm}/{uuid}.{ext}`, URL công khai là
  `MEDIA_PUBLIC_URL/{key}`, hoặc `/media/{key}` của Worker nếu không đặt `MEDIA_PUBLIC_URL`.
- Chưa có binding: tạm lưu file trong PocketBase `media_library` (vẫn tính hạn mức).

Bật R2: `wrangler r2 bucket create dashpoc-media`, bỏ comment `r2_buckets` trong `wrangler.jsonc`, deploy.
Với Instagram/Facebook nên đặt custom domain cho bucket và `MEDIA_PUBLIC_URL`.

## Migration

`node scripts/pb-migrate.mjs` thêm `tenants.storage_used`, `tenants.storage_limit_bytes`,
`media_library.size_bytes`, `media_library.r2_key`. File cũ chưa có `size_bytes` nên chưa được tính vào hạn mức.

## API (xác thực bằng token PocketBase như `/api/account/*`)

- `GET /api/account/media/usage` → `{ plan, used_bytes, limit_bytes, remaining_bytes }`
- `POST /api/account/media` (multipart: `tenant`, `file`, `label`) → 201 `{ media }`
- `PATCH /api/account/media/:id` (`{ label }`) → đổi tên
- `DELETE /api/account/media/:id` → xoá file, hoàn dung lượng
- `GET /media/*` → phục vụ object R2
