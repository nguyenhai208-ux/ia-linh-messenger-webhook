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
- **Đã push và merge thành công lên GitHub** (`git merge --allow-unrelated-histories` để giữ nguyên lịch sử 9 commit cũ, không ép/xóa gì) và **Render đã tự build + deploy bản ghép** — xác nhận qua `/healthz` (đúng field mới: thư viện 138, `outbound_sending:false`), `/webhook` (403 đúng khi token sai), `/assistant` (hiện trang đăng nhập Facebook).
- **Đã thêm biến `INTERNAL_API_KEY`** còn thiếu trên Render (nguyên nhân khiến bản deploy đầu tiên bị crash exit code 1) — đã sinh giá trị ngẫu nhiên, không có ở đâu khác ngoài Render.

- **Đã bật đồng bộ Lark Base cho production** (2026-09-01, theo xác nhận của bạn): thêm `LARK_BASE_SYNC_ENABLED=true`, `LARK_APP_ID`, `LARK_APP_SECRET` vào Render, redeploy thành công, `/healthz` xác nhận `lark_base_sync: true`.

Còn lại — cần bạn xác nhận/thao tác:

- **Đặt `STAFF_FACEBOOK_IDS`** trên Render — hiện để trống nghĩa là **bất kỳ tài khoản Facebook nào đăng nhập cũng vào được dashboard `/assistant`**. Cần bạn cung cấp Facebook ID của (các) sale được phép dùng.
- `APP_SECRET`/`VERIFY_TOKEN` trên Render giữ nguyên giá trị cũ (không đụng vào, không đọc giá trị) vì Meta đã xác minh thành công với các giá trị này từ trước.
- **Gửi 1 tin nhắn thật qua Fanpage** để xác nhận luồng đầu-cuối với traffic Messenger thật (đã test kỹ code path tương đương ở local, nhưng chưa xác nhận với Meta thật vì không đọc secret Render để tự giả lập). Sau khi gửi, kiểm tra bảng Lark `Messenger AI – Thử nghiệm` có bản ghi mới + đăng nhập `/assistant` xem gợi ý hiện ra.

## 8. Sự cố phát hiện 2026-09-02: đăng nhập dashboard bị chặn — cần xác minh doanh nghiệp

Khi thử đăng nhập `/assistant` bằng tài khoản Facebook "Nguyễn Hải" (đã có vai trò Quản trị viên trên app "Chat bot"), Facebook trả về màn hình lỗi **"Ứng dụng không hoạt động"** — chặn ngay từ phía Facebook, không hề chạm tới server (xác nhận qua log Render trống hoàn toàn trong 24h, dù thành công hay thất bại đều phải được log).

**Đã loại trừ các nguyên nhân khác** trước khi kết luận đúng nguyên nhân:
- Redirect URI trên Meta khớp chính xác với `PUBLIC_BASE_URL` code đang dùng.
- `FACEBOOK_LOGIN_CONFIG_ID` trên Render (`2115795552640771`) khớp đúng config "Trợ lý Messenger nội bộ" trên Meta.
- Tài khoản test đã có vai trò Quản trị viên trên app.

**Nguyên nhân thật**: tính năng "Đăng nhập bằng Facebook **cho doanh nghiệp**" (Facebook Login for Business) — sản phẩm mà server đang dùng vì có `FACEBOOK_LOGIN_CONFIG_ID` — yêu cầu **Xác minh doanh nghiệp** (Business Verification) mới hoạt động được, kể cả với tài khoản Quản trị viên ở chế độ phát triển. Đây là hạn chế đặc thù của sản phẩm "Login for Business" (khác với Facebook Login thường).

**Đã thực hiện (2026-09-02)**: bạn đã tạo hồ sơ doanh nghiệp trên Meta Business Suite tên "Công ty Cổ phần Gia Linh FNG" và gửi thông tin xác minh cho pháp nhân "GIA LINH FNG JOINT STOCK COMPANY". Trạng thái hiện tại: **"Đang xem xét"** — Meta báo cần khoảng 2 ngày làm việc để duyệt.

**Việc này không liên quan đến thuế** — đây là bước Meta tự xác minh danh tính doanh nghiệp (chống giả mạo), không phải thủ tục với cơ quan thuế và Meta không chia sẻ thông tin này cho cơ quan thuế. Giấy tờ dùng để xác minh (giấy đăng ký kinh doanh) có chứa mã số thuế công ty vì ở Việt Nam đó cũng là số đăng ký kinh doanh, nhưng việc gửi cho Meta không tạo ra nghĩa vụ thuế mới nào.

**Sau khi Meta duyệt xong (~2 ngày)**: quay lại thử đăng nhập `/assistant` bằng tài khoản Facebook thật — lúc đó "Ứng dụng không hoạt động" sẽ hết, và có thể tiếp tục đặt `STAFF_FACEBOOK_IDS` + xác nhận luồng thật đầu-cuối (mục còn lại ở trên).

**Lối tắt đã cân nhắc nhưng chưa áp dụng**: có thể bỏ `FACEBOOK_LOGIN_CONFIG_ID` trên Render để code tự chuyển về Facebook Login thường (không cần xác minh doanh nghiệp, xem nhánh `else` trong `/auth/facebook` ở `server.js`) — nhưng chưa chắc app đã bật sẵn use case Facebook Login thường (hiện chỉ thấy "Đăng nhập bằng Facebook cho doanh nghiệp" trong danh sách use case), nên có thể cần thêm bước cấu hình trên Meta trước khi thử. Bạn đã chọn đi thẳng theo đường xác minh doanh nghiệp chính thức thay vì lối tắt này.
