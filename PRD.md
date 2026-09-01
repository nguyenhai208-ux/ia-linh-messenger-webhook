# PRD — Hệ thống AI gợi ý Messenger – Gia Linh FNG

## 1. Mục tiêu

Xây dựng hệ thống AI hỗ trợ sale/tuyển sinh xử lý tin nhắn Messenger:

- Nhận nội dung khách nhắn.
- Phân tích ý định và đưa tối đa 3 gợi ý trả lời cho sale.
- Sale/quản lý duyệt trước khi dùng.
- Ghi nhật ký gợi ý vào một bảng Base mới để theo dõi.
- Không tự gửi Messenger, không tự chốt học phí/chỗ trống/ưu đãi.

## 2. Phạm vi dữ liệu

Chỉ sử dụng bảng mới:

- Base: `BÁO CÁO ĐIỀU HÀNH - GIA LINH FNG` (`MOqwbuHCaa00cAskjDRljqYUggd`)
- Bảng: `Messenger AI – Thử nghiệm` (`tbl3FxaqNVXUXhcN`)

Không sửa, xóa, cập nhật hoặc lấy dữ liệu từ các bảng Base cũ (bao gồm `Bảng` và `AI Đối soát – Dữ liệu đọc` trong cùng Base).

Các trường cần lưu:

- Mã phiên
- Thời điểm nhận
- Nội dung đã che số điện thoại/email/dãy số nhạy cảm
- Ý định AI
- Gợi ý AI
- Trạng thái duyệt
- Người phụ trách
- Hạn follow-up
- Kết quả sale

> Ghi chú triển khai: `src/lark-base-sync.js` hiện chỉ ghi 6/9 trường ở bước tạo record (Mã phiên, Thời điểm nhận, Nội dung đã che, Ý định AI, Gợi ý AI, Trạng thái duyệt). Ba trường còn lại (Người phụ trách, Hạn follow-up, Kết quả sale) do sale/quản lý điền thủ công sau khi duyệt. Đã xác nhận (2026-08-31) cả 9 tên cột trong code khớp chính xác với bảng thật qua `GET .../fields`.

## 3. Luồng vận hành

```
Messenger / màn hình nội bộ
        ↓
AI phân loại và chọn kịch bản
        ↓
Gợi ý trả lời + cảnh báo cần xác minh
        ↓
Bảng "Messenger AI – Thử nghiệm"
        ↓
Sale/Quản lý duyệt
        ↓
Sale tự gửi câu trả lời
```

AI chỉ tạo nháp. Con người chịu trách nhiệm duyệt và gửi.

## 4. Ba giai đoạn triển khai

### Giai đoạn 1 — Chạy cục bộ

- Chạy dịch vụ AI nội bộ.
- Dùng thư viện 138 kịch bản tư vấn đã duyệt.
- Có API kiểm tra sức khỏe (`GET /healthz`) và API tạo gợi ý (`POST /suggestions`).
- Không kết nối Messenger thật.
- Không ghi Base thật.
- Không gửi tin tự động.

### Giai đoạn 2 — Lark Base thử nghiệm

- Tạo app Lark riêng: Messenger AI – Base thử nghiệm.
- Chỉ tạo/đọc/cập nhật bản ghi trong bảng mới.
- Khi có yêu cầu `sync_to_lark`, ghi một bản ghi chờ duyệt.
- Không được chuyển cấu hình sang bảng Base cũ (khóa cứng trong code, không qua env).
- Không lưu secret trong chat, Wiki hay tài liệu.

### Giai đoạn 3 — AI gợi ý và kiểm soát an toàn

- Trả tối đa 3 gợi ý dựa trên kịch bản đã duyệt.
- Các câu hỏi về học phí, ưu đãi, chỗ trống, sĩ số, lịch học phải gắn cảnh báo "cần xác minh".
- Yêu cầu hồ sơ học sinh, mật khẩu, camera, dữ liệu vận hành không công khai phải chuyển quản lý duyệt.
- Không đánh giá khách theo tên, ảnh đại diện, tuổi tài khoản hay suy đoán danh tính.
- Không có chức năng gửi Messenger tự động.

## 5. Bảo mật và quyền

- App Secret Lark và Meta chỉ được nhập trực tiếp trong file `.env` tại máy.
- Không gửi secret/token vào chat.
- App Lark chỉ cần quyền Base tối thiểu: đọc Base, tạo/đọc/cập nhật bản ghi.
- App phải được thêm làm Editor cho đúng Base thử nghiệm trước khi có thể ghi dữ liệu.
- Mọi dữ liệu lưu phải được che số điện thoại, email và dãy số nhạy cảm.

## 6. Tiêu chí nghiệm thu

- [x] Dịch vụ chạy ổn định cục bộ.
- [x] 15/15 kiểm thử kỹ thuật đạt.
- [x] API trả gợi ý và luôn báo `outbound_sending=false`.
- [x] Không phát sinh gửi Messenger tự động.
- [x] Ca thử ghi thành công đúng một bản ghi giả vào bảng mới.
- [x] Không có thay đổi ở các bảng Base cũ.
- [x] Sale nhìn thấy trạng thái "Chờ duyệt" trước khi sử dụng gợi ý.

## 7. Trạng thái hiện tại (2026-09-01)

Đã xong:

- Bảng Base mới, App Lark mới đã phát hành.
- Dịch vụ AI cục bộ và thư viện 138 kịch bản.
- Mã khóa cứng đích ghi vào đúng bảng thử nghiệm (`tbl3FxaqNVXUXhcN`) — đã sửa lỗi trỏ nhầm sang bảng `Bảng` (`tbl6dJjA1iQvS4V0`), xem `CLAUDE.md`.
- Đã cấp đủ scope Bitable + Bot + quyền Advanced Permission cho app Lark — ghi Lark Base thật đã chạy được (xem `CLAUDE.md` mục "Lark write access").
- **Phát hiện quan trọng:** đã có sẵn hạ tầng production từ trước (không phải do phiên làm việc này dựng) — Meta app "Chat bot" (`2473856919758911`) đã đăng ký Messenger + webhook, và một bản deploy khác trên Render (`gia-linh-messenger-webhook.onrender.com`, kéo từ GitHub `nguyenhai208-ux/ia-linh-messenger-webhook`) đã chạy sẵn một dashboard nội bộ cho sale (đăng nhập bằng Facebook, xem gợi ý, copy/sửa rồi tự gửi tay) — nhưng dùng luật từ khóa tự chế, không dùng thư viện 138 kịch bản, và chỉ lưu tạm trong bộ nhớ (mất khi restart), không ghi Lark Base.
- **Đã ghép 2 bản lại**: giữ khung dashboard + đăng nhập Facebook đang chạy, thay ruột gợi ý bằng thư viện 138 kịch bản đã duyệt + bộ lọc an toàn 2 mức, nối thêm ghi Lark Base tự động khi có tin nhắn thật. Đã kiểm thử qua service local: gửi 1 tin nhắn giả dạng thật qua `/webhook` → hiện đúng trong dashboard → tự ghi vào Lark Base → xóa sạch bản ghi test sau khi xác nhận. 18/18 test kỹ thuật đạt (bổ sung 3 test mới cho đúng luồng webhook → dashboard, vì lỗ hổng "tin thật nhưng không ai kiểm tra có tạo gợi ý không" từng khiến lỗi bảng Lark trước đây lọt qua).
- Sửa lỗi sẽ làm sập deploy: script `start` cũ dùng `node --env-file=.env`, trên Render không có file `.env` nên sẽ crash ngay khi khởi động — đã tách `start` (không cần `.env`) và `dev` (dùng `.env`, cho máy local).

Còn lại — cần bạn xác nhận/thao tác trước khi đẩy code lên Render:

- Đẩy code đã ghép lên GitHub (`git push`) để Render tự động deploy bản mới.
- Đối chiếu lại biến môi trường trên Render cho khớp: `APP_SECRET` phải là secret thật (32 ký tự hex) của app "Chat bot", `VERIFY_TOKEN` phải khớp đúng "Xác minh mã" đã khai trên Meta, và cần đặt `STAFF_FACEBOOK_IDS` — hiện đang để trống nghĩa là **bất kỳ tài khoản Facebook nào đăng nhập cũng vào được dashboard**.
- Xác nhận Render đã build đúng bản mới (kiểm tra `/healthz` trả về đúng field mới), rồi gửi 1 tin nhắn thật qua Fanpage để xác nhận luồng thật hoạt động đầu-cuối.
