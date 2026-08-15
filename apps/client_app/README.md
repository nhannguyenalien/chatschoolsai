# Schools AI Flutter app

Ứng dụng dùng chung codebase Flutter/Dart cho Android, iOS, Windows và macOS.

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
flutter build macos --release
```

Build iOS cần macOS + Xcode; build Windows release cần Windows hoặc CI runner Windows. Trước production, thay API key dev bằng access token ngắn hạn và refresh token từ backend.

## CI/CD và cập nhật OTA

- Mỗi lần push lên `main`, workflow **Build Schools AI (4 platforms)** chạy test rồi build Android, iOS, Windows và macOS song song. Bản Apple trong artifact là bản unsigned để kiểm thử; bản phân phối thật cần Apple signing/notarization.
- Tag `client-vX.Y.Z` tạo GitHub Release và đính kèm các gói của cả bốn nền tảng.
- Shorebird hiện hỗ trợ Code Push cho cả bốn nền tảng. Trước khi dùng lần đầu, cài Shorebird CLI, đăng nhập và chạy trong thư mục này:

  ```bash
  shorebird init
  ```

  Commit file `shorebird.yaml` được tạo ra, sau đó tạo API key trong Shorebird Console và thêm GitHub repository secret tên `SHOREBIRD_TOKEN`.
- Vào GitHub Actions → **Shorebird release or OTA patch (4 platforms)** → Run workflow → chọn `release` để tạo bản nền có Shorebird. Chỉ các app được cài từ bản nền này mới nhận OTA.
- Sau khi sửa Dart/Flutter, chạy workflow với `patch`, hoặc push tag `client-patch-<ten-ban-va>` để tự patch cả bốn nền tảng. Tag tự động dùng release mới nhất.
- Patch OTA không thay thế full release khi đổi native code, plugin native, quyền hệ điều hành hoặc asset không tương thích. Khi đó tăng `version` trong `pubspec.yaml` và tạo base release mới.

### Signing cần cấu hình trước production

- Android hiện dùng debug signing, chỉ phù hợp cài thử. Cần keystore release trước khi đưa Play Store.
- iOS cần Apple Distribution certificate và provisioning profile.
- macOS cần Developer ID/Application certificate, hardened runtime và notarization để tránh cảnh báo Gatekeeper.
- Windows portable ZIP chạy được để test; có thể bổ sung MSIX/code-signing certificate khi phát hành rộng rãi.

Rollback OTA thực hiện trong Shorebird Console bằng cách vô hiệu hóa patch lỗi; thiết bị sẽ quay về patch ổn định gần nhất ở lần khởi động tiếp theo.
