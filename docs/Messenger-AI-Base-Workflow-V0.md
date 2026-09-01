# Workflow Messenger AI – Lark Base thử nghiệm

Mã: GLF-AI-WF-MSG-001 | Chủ sở hữu: Admin | Phiên bản: V0 | Trạng thái: Cần xác minh | Cập nhật: 2026-08-28 | Rà soát: sau ca ghi thử đầu tiên | Mức bảo mật: Nội bộ

## Phạm vi

Hệ thống tạo tối đa ba nháp trả lời từ thư viện v10 gồm 138 kịch bản đã duyệt. Không gửi Messenger tự động. Nếu được bật riêng, hệ thống chỉ tạo bản ghi trong bảng `Messenger AI – Thử nghiệm` của Base `BÁO CÁO ĐIỀU HÀNH - GIA LINH FNG`.

## Nguồn và đầu ra

- Đầu vào: câu hỏi Messenger được màn hình nội bộ gửi tới `POST /suggestions`.
- Đầu ra: nháp cần người duyệt; khi có `sync_to_lark: true`, bản ghi trạng thái `Chờ duyệt`.
- Trường lưu: mã phiên, thời điểm, nội dung đã che email/số điện thoại/dãy số, ý định, gợi ý AI và trạng thái duyệt.

## Cổng kiểm soát

1. `LARK_BASE_SYNC_ENABLED=false` là mặc định.
2. Chỉ khi người vận hành đặt `true` và gọi có `sync_to_lark: true` thì mới tạo bản ghi.
3. Mã nguồn khóa cứng Base/token bảng đích; biến môi trường không thể đổi sang bảng cũ.
4. Mọi gợi ý cần người phụ trách duyệt; không có API gửi Messenger.
5. Yêu cầu về hồ sơ cá nhân, thông tin truy cập hoặc nhiều dữ liệu vận hành không công khai được chuyển sang nháp an toàn để quản lý xem xét.

## Cần xác minh trước khi chuyển trạng thái Đã kiểm chứng

- Nhập `LARK_APP_SECRET` trực tiếp tại máy; không đưa secret vào chat, tài liệu hay kho tri thức.
- Chạy một ca ghi thử bằng dữ liệu giả và xác minh chỉ bảng mới có thêm đúng một bản ghi.
- Cấu hình/kiểm tra Meta webhook công khai HTTPS bằng thông tin ứng dụng Meta được cấp.

## Cách bàn giao secret

Codex tạo sẵn file `.env` và mở đúng dòng bằng TextEdit. Người sở hữu tự dán secret, bật cờ liên quan và lưu; chỉ cần báo đã lưu, không gửi giá trị secret cho Codex.

## Bằng chứng

- Mã nguồn: `server.js`, `src/lark-base-sync.js`, `src/suggestion-engine.js`.
- Kiểm thử cục bộ 2026-08-28: 15/15 pass; `outbound_sending=false`; yêu cầu đồng bộ khi đang tắt trả `synced=false`.
