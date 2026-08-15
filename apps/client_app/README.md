# Schools AI Flutter app

Ứng dụng dùng chung codebase Flutter/Dart cho Android, iOS và Windows.

## Phần đã có

- Đăng nhập bằng tenant API key dành cho giai đoạn dev, lưu trong secure storage.
- API client có Bearer authentication, timeout và thông báo lỗi phổ biến.
- Dashboard lấy dữ liệu thật từ `GET /api/v1/status`.
- Navigation responsive: bottom navigation trên điện thoại, navigation rail trên desktop.
- Module Bài viết: danh sách, lọc trạng thái, chi tiết nội dung/kênh, duyệt bài có xác nhận.
- AI Agent: hội thoại nhiều lượt qua `POST /api/v1/agent-chat`, trạng thái gửi/lỗi và cảnh báo dữ liệu nhạy cảm.
- Khung tính năng Loyalty để nối API ở sprint tiếp theo.

## Chạy local

```bash
flutter pub get
flutter run \
  --dart-define=APP_ENV=development \
  --dart-define=API_BASE_URL=https://apic.schoolsai.work
```

Nếu chạy Android emulator và API ở máy local, thường dùng `http://10.0.2.2:<port>` thay cho `localhost`.

## Kiểm tra

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

## Build

```bash
flutter build apk --release
flutter build ipa --release
flutter build windows --release
```

Build iOS cần macOS + Xcode; build Windows release cần Windows hoặc CI runner Windows. Trước production, thay API key dev bằng access token ngắn hạn và refresh token từ backend.
