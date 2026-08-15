# Kế hoạch xây dựng app Flutter

## 1. Quyết định kỹ thuật

- App đa nền tảng dùng **Flutter + Dart**, ưu tiên Android, iOS và Windows từ cùng một codebase.
- UI dùng **Material 3** với theme riêng của sản phẩm; layout responsive/adaptive cho điện thoại, tablet và desktop.
- Giữ nguyên `dash-tabler/` làm web admin trong giai đoạn đầu. Không chuyển từng trang HTML sang Flutter một cách máy móc.
- Giữ nguyên Cloudflare Worker và PocketBase làm backend. App chỉ gọi API qua Worker; không truy cập trực tiếp collection PocketBase, ngoại trừ công cụ super-admin hiện có.
- Business rule nhạy cảm như tenant isolation, duyệt/đăng bài, cấp lượt quay, random giải và claim phần thưởng tiếp tục nằm ở server.

## 2. Mục tiêu bản đầu tiên

Bản đầu tiên phải giúp chủ cửa hàng hoặc nhân viên thực hiện được các công việc chính:

1. Đăng nhập an toàn và vào đúng tenant.
2. Xem tổng quan trạng thái hệ thống.
3. Chat với AI Agent.
4. Xem, duyệt và theo dõi bài đăng.
5. Tra cứu khách hàng loyalty, ghi nhận giao dịch và sử dụng Reward World.
6. Chạy ổn định trên Android, iOS và Windows với UI phù hợp kích thước màn hình.

Ngoài phạm vi bản đầu:

- Thay thế toàn bộ web admin Tabler.
- Super-admin Reward World trên mobile.
- Trình soạn thảo content nâng cao và content planning đầy đủ.
- Billing, cấu hình AI chuyên sâu, import/migration dữ liệu.
- Offline-first hoàn chỉnh. MVP chỉ cache dữ liệu đọc gần nhất và hàng đợi retry có kiểm soát cho thao tác phù hợp.

## 3. Cấu trúc workspace đề xuất

```text
dashpoc/
  apps/
    client_app/                 # Flutter app iOS/Android/Windows
      lib/
        app/                    # bootstrap, router, theme
        core/                   # networking, auth, storage, errors
        features/
          auth/
          dashboard/
          agent_chat/
          posts/
          loyalty/
        shared/                 # widget/model dùng chung
      test/
      integration_test/
  dash-tabler/                  # web admin hiện tại
  worker-chat-d/knowledge-worker/ # API hiện tại
  docs/
```

Mỗi feature Flutter tách theo ba lớp vừa đủ dùng:

```text
feature/
  data/          # DTO, API client, repository implementation
  domain/        # entity, repository contract, use case khi cần
  presentation/  # screen, widget, controller/state
```

Không tạo abstraction khi chưa có nhu cầu thực tế; chỉ tách lớp ở các luồng có state hoặc business rule đáng kể.

## 4. Stack Flutter

| Nhu cầu | Lựa chọn |
|---|---|
| UI | Flutter Material 3 |
| Responsive | `LayoutBuilder`, navigation adaptive; package bổ sung chỉ khi cần |
| State management/DI | Riverpod |
| Routing | go_router |
| HTTP | Dio |
| Model JSON | json_serializable; Freezed chỉ dùng cho state/model phức tạp |
| Token storage | flutter_secure_storage |
| Cache nhẹ | Drift hoặc SQLite; chỉ thêm sau khi luồng online ổn định |
| Logging | lớp logger nội bộ, tự loại token và dữ liệu nhạy cảm |
| Testing | flutter_test, mocktail, integration_test |

Nguyên tắc chọn dependency:

- Chỉ nhận package còn được duy trì và hỗ trợ cả ba nền tảng mục tiêu.
- Package đụng native API phải được kiểm tra Android/iOS/Windows trước khi đưa vào core.
- Khóa version trong `pubspec.lock`; nâng cấp theo nhịp nhỏ, không dồn nhiều major version.

## 5. Xác thực và bảo mật

API hiện dùng tenant API key. Key này phù hợp cho tích hợp server-to-server nhưng không nên nhúng cố định trong app phát hành cho người dùng.

Trước khi phát hành production cần bổ sung luồng auth dành cho app:

1. Người dùng đăng nhập bằng tài khoản.
2. Worker xác thực và trả access token ngắn hạn cùng refresh token có thể thu hồi.
3. Tenant và quyền được suy ra từ token phía server, không tin `tenant` do client gửi.
4. Token được lưu trong Keychain/Keystore/Windows Credential Storage qua secure storage.
5. Có endpoint refresh, logout/revoke và danh sách quyền tối thiểu như `owner`, `manager`, `staff`.

Trong giai đoạn development có thể dùng API key nhập qua cấu hình dev, lưu secure storage và tuyệt đối không commit vào source code.

## 6. Thiết kế điều hướng

Điện thoại dùng bottom navigation cho các chức năng chính; tablet/Windows chuyển sang navigation rail hoặc sidebar:

- Tổng quan
- Agent
- Bài viết
- Loyalty
- Thêm: Knowledge, Analytics, Settings ở các phase sau

Các trạng thái loading, empty, error, retry và mất mạng phải có thiết kế chung, không để từng màn tự xử lý khác nhau.

## 7. Các phase triển khai

### Phase 0 — Khởi tạo nền tảng

- Tạo project tại `apps/client_app` với Android, iOS và Windows.
- Thiết lập flavor `dev`, `staging`, `production` và base URL theo môi trường.
- Tạo theme Material 3, màu thương hiệu, typography và component cơ bản.
- Thiết lập Riverpod, go_router, Dio, secure storage, error mapping và logging an toàn.
- Tạo adaptive shell chạy được trên màn hình mobile và Windows.
- Bổ sung lint, unit test mẫu và CI chạy analyze/test/build smoke.

**Hoàn thành khi:** app mở được trên ít nhất Android emulator và một desktop target hiện có; route, theme, config môi trường và test nền tảng đều chạy.

### Phase 1 — Auth và Dashboard

- Màn đăng nhập, giữ phiên, refresh/logout và route guard.
- Tạm hỗ trợ API-key dev cho đến khi backend token auth hoàn thành.
- Dashboard gọi `GET /api/v1/status` và các endpoint tổng quan cần thiết.
- Hiển thị pending, approved, scheduled, published, error và thao tác refresh.
- Chuẩn hóa `ApiResult`, lỗi 401/403/429/5xx và timeout.

**Hoàn thành khi:** người dùng chỉ thấy dữ liệu đúng tenant, phiên đăng nhập phục hồi sau khi mở lại app, lỗi mạng có cách thử lại rõ ràng.

### Phase 2 — Agent Chat

- Giao diện hội thoại, danh sách message và trạng thái gửi.
- Tích hợp `POST /api/v1/agent-chat` và lịch sử liên quan.
- Render kết quả tool/action an toàn; xác nhận người dùng trước thao tác có tác động đáng kể.
- Giữ draft cục bộ và chống gửi trùng khi người dùng bấm nhiều lần.

**Hoàn thành khi:** chat nhiều lượt hoạt động, đóng/mở app không mất draft và lỗi request không tạo message trùng.

### Phase 3 — Posts và duyệt đăng

- Danh sách bài theo trạng thái qua `GET /api/v1/posts`.
- Chi tiết bài, media, target platform, lịch đăng và error log.
- Duyệt bài qua `POST /api/v1/posts/:id/approve` có confirmation.
- Trigger publish khi người dùng có quyền; thao tác phải idempotent hoặc khóa nút trong lúc xử lý.
- Bản đầu chỉ hỗ trợ chỉnh sửa nội dung tối thiểu nếu API hiện có đáp ứng; composer nâng cao để phase sau.

**Hoàn thành khi:** xem và duyệt bài được từ cả mobile/Windows, trạng thái sau thao tác đồng bộ lại từ server.

### Phase 4 — Loyalty và Reward World

- Đọc cấu hình qua `GET /api/v1/loyalty/program`.
- Tra cứu tài khoản/điểm khách hàng.
- Ghi giao dịch qua `POST /api/v1/loyalty/sales` với idempotency key do client tạo.
- Danh sách campaign, tham gia campaign và hiển thị lượt quay.
- Gọi spin; animation chỉ trình bày kết quả server đã quyết định, không random ở client.
- Danh sách phần thưởng và xác nhận giao thưởng theo endpoint hiện có.

**Hoàn thành khi:** retry hoặc bấm lặp không ghi trùng sale/spin/claim; kết quả và giới hạn giải luôn lấy từ server.

### Phase 5 — Hoàn thiện đa nền tảng

- Kiểm tra responsive cho phone nhỏ, tablet và cửa sổ Windows resize.
- Keyboard navigation, focus, hover và shortcut cơ bản trên Windows.
- Deep link/app link cho màn phù hợp.
- Accessibility: semantic labels, font scaling, contrast và touch target.
- Icon, splash screen, signing, package identity và cấu hình store.
- Crash reporting/analytics chỉ bật sau khi có chính sách privacy và lọc dữ liệu nhạy cảm.

**Hoàn thành khi:** có artifact release thử nghiệm cho Android, iOS và Windows; checklist smoke test ba nền tảng đạt.

### Phase 6 — Các module tiếp theo

Thực hiện dựa trên phản hồi bản đầu, theo thứ tự dự kiến:

1. Knowledge và đồng bộ tri thức.
2. Content composer/content planning.
3. Analytics.
4. Bot và social configuration.
5. Leads, messages và billing.
6. Offline queue nâng cao nếu dữ liệu sử dụng thực tế chứng minh cần thiết.

## 8. Phần backend cần bổ sung

Không chặn việc dựng UI và gọi API dev, nhưng cần hoàn thành trước production:

- Auth access/refresh token cho người dùng app và revoke session.
- RBAC theo tenant.
- Contract API có version, schema lỗi thống nhất và request ID.
- Pagination/cursor cho posts, messages, rewards và lịch sử loyalty.
- Idempotency key cho mọi lệnh tạo giao dịch hoặc trao thưởng.
- Endpoint tổng hợp dashboard để giảm số request trên mobile.
- Rate limit theo user/tenant và audit log cho thao tác nhạy cảm.
- OpenAPI hoặc contract machine-readable để kiểm tra tương thích client/server.

## 9. Chiến lược kiểm thử

- Unit test: mapper, repository, controller và state transition.
- Widget test: login, navigation, list/detail, empty/error/loading.
- Contract test: response fixture của Worker phải deserialize được ở Flutter.
- Integration test: login → dashboard → chat; posts → approve; loyalty → sale → spin → claim.
- Backend test tiếp tục là nguồn xác nhận business rule và tenant isolation.
- Smoke test thủ công trên Android, iOS và Windows trước mỗi bản phát hành.

Mục tiêu ban đầu:

- Logic quan trọng và state controller có test.
- Không lấy phần trăm coverage tổng thể làm mục tiêu thay cho kiểm thử đúng luồng rủi ro.
- Mọi bug production phải có regression test nếu có thể tái hiện tự động.

## 10. Definition of Done cho từng feature

Một feature chỉ được xem là xong khi:

- Có đủ loading, empty, success, error và retry.
- Không log token, API key hoặc nội dung nhạy cảm.
- Có unit/widget test cho luồng chính và lỗi quan trọng.
- Chạy responsive trên mobile và Windows.
- Text sẵn sàng cho i18n; bản đầu ưu tiên tiếng Việt, cấu trúc cho phép thêm tiếng Anh.
- API contract được ghi lại và không truy cập PocketBase trực tiếp.
- `flutter analyze` và toàn bộ test liên quan đều pass.

## 11. Thứ tự thực thi ngay

Batch đầu tiên sẽ chỉ làm nền móng có thể chạy và kiểm chứng:

1. Scaffold `apps/client_app` cho Android/iOS/Windows.
2. Tạo theme, adaptive app shell và bốn route placeholder chính.
3. Tạo environment config, Dio client, secure storage và API error model.
4. Tích hợp auth dev và `GET /api/v1/status` cho Dashboard.
5. Viết test cho config, auth guard, API mapping và Dashboard states.
6. Chạy analyze/test và build smoke trên các target có sẵn.

Sau khi batch này ổn định mới triển khai Agent Chat, Posts và Loyalty theo thứ tự trên.

## 12. Rủi ro cần kiểm soát sớm

| Rủi ro | Cách xử lý |
|---|---|
| API key bị trích xuất từ app | Không hard-code; bổ sung user token trước production |
| Package chỉ hỗ trợ mobile | Kiểm tra Windows trước khi nhận dependency |
| UI desktop chỉ là mobile phóng lớn | Adaptive shell và breakpoint từ Phase 0 |
| Client lặp giao dịch khi mạng chập chờn | Idempotency key và server-side uniqueness |
| Flutter/backend lệch contract | Fixture/contract test và schema API thống nhất |
| Phạm vi quá rộng | Giữ web Tabler cho admin; Flutter làm các workflow chính trước |

## 13. Kết quả bàn giao MVP

- Một source Flutter chung cho Android, iOS và Windows.
- Các luồng Auth, Dashboard, Agent Chat, Posts approval và Loyalty/Reward World hoạt động end-to-end.
- Không thay đổi hoặc nhân đôi business rule đang có ở backend.
- Bộ test tự động và checklist release ba nền tảng.
- Tài liệu cấu hình môi trường, build, signing và phát hành nội bộ.
