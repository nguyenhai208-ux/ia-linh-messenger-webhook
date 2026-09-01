# Quy tắc cho agent — messenger-ai-service

Áp dụng cho mọi AI agent (Claude, Codex, ...) khi làm việc trong thư mục này. Bổ sung cho `AGENTS.md` và `QUY_TAC_VAN_HANH.md` ở thư mục cha — các quy tắc đó vẫn có hiệu lực.

## Bất biến an toàn — không được vi phạm

- Không thêm bất kỳ đường dẫn nào gửi tin nhắn Messenger. Dự án này cố tình không có endpoint gửi.
- `/suggestions` luôn phải trả `outbound_sending: false` và `requires_human_approval: true`.
- `src/inquiry-safety.js` chỉ được đánh giá nội dung văn bản tin nhắn — không dùng tên, ảnh đại diện, tuổi tài khoản hay bất kỳ thuộc tính danh tính nào của người gửi.
- Đồng bộ Lark phải luôn tắt theo mặc định (`LARK_BASE_SYNC_ENABLED=false`), chỉ bật khi người dùng yêu cầu cụ thể. Khi đã bật, tin nhắn thật qua `/webhook` tự động ghi Lark (không cần cờ riêng từng tin) — vì bản thân tin nhắn khách chính là "yêu cầu"; endpoint `/suggestions` thủ công vẫn cần thêm `sync_to_lark: true` mỗi lần gọi.
- `npm start` (dùng để deploy) không được phụ thuộc file `.env` — môi trường host (Render) không có file này, chỉ tiêm biến qua dashboard riêng. Dùng `node --env-file=.env` chỉ trong script `dev`, không đưa vào `start`.

## Trước khi sửa `src/lark-base-sync.js`

`appToken`/`tableId` trong file này là allowlist khóa cứng, cố ý không cho phép biến môi trường trỏ sang bảng cũ. Ngày 2026-08-29 từng phát hiện `tableId` bị trỏ sai sang bảng `Bảng` (mặc định) thay vì bảng `Messenger AI – Thử nghiệm` — lỗi này không bị 15/15 test bắt được vì test chưa từng gọi thật đường ghi Lark.

**Trước khi đổi hằng số này**: gọi `GET /open-apis/bitable/v1/apps/{base}/tables` để lấy danh sách bảng thật và đối chiếu tên, không tin vào comment trong code hay giá trị cũ.

## Quyền ghi dữ liệu

Không tự ý cấp/sửa quyền chia sẻ (Editor/Owner) trên Base thật — đây là hành động ảnh hưởng hệ thống dùng chung, chỉ người sở hữu Base thực hiện qua giao diện Lark. Agent chỉ kiểm tra lại kết quả bằng API sau khi người dùng xác nhận đã cấp.

## Quy tắc phối hợp với người dùng (2026-08-29)

- Không hỏi các câu xác nhận cho những thao tác đơn giản, có thể tự làm và tự kiểm chứng lại (cài công cụ dev, chạy test, sửa lỗi trong code, đọc dữ liệu qua API đã có quyền, tạo/cập nhật tài liệu trong dự án). Cứ tự thực hiện rồi báo cáo kết quả thật (đã chạy gì, kết quả gì, còn lỗi gì) — không suy đoán kết quả khi chưa chạy thật.
- Chỉ dừng lại hỏi người dùng khi thật sự cần tài khoản/mật khẩu/đăng nhập của họ (ví dụ: cấp scope cho app trên Lark Developer Console, đăng nhập Meta for Developers). Khi cần, phải mở sẵn đúng trang thao tác (qua trình duyệt) cho người dùng bấm/nhập, không chỉ dán một đường link rồi chờ.
- Vẫn giữ nguyên các giới hạn an toàn ở trên (không tự cấp/sửa quyền chia sẻ Base, không tự đổi allowlist Base/table mà không đối chiếu API thật).
- Đầu ra của mỗi bước cần rõ ràng, đúng trọng tâm nghiệm thu trong `PRD.md` — tránh làm lan man, đi lệch hướng khỏi tiêu chí đã định.

## Chạy dự án

```
npm install
npm test
npm run dev    # doc .env, lang nghe cong $PORT -- chay o may local
npm start      # khong doc .env -- doc bien moi truong he thong, giong Render
```

Không có dependency ngoài built-in của Node 20+. Nếu `npm install` từng thêm dependency thật, cập nhật lại ghi chú này kèm lý do.

## Hạ tầng đã có sẵn — kiểm tra trước khi tạo mới

Repo GitHub thật là `nguyenhai208-ux/ia-linh-messenger-webhook` (thiếu chữ "g" đầu — không phải `gia-linh-messenger-webhook`). Deploy production ở Render (`gia-linh-messenger-webhook.onrender.com`) tự build từ nhánh `main` của repo này. Meta app đúng để dùng là "Chat bot" (`2473856919758911`) — app "Gia Linh Messenger Staff" là ngõ cụt, không thêm được Messenger. Chi tiết đầy đủ và lịch sử ghép 2 codebase độc lập (bản CRM luật tự chế đang chạy thật + bản 138-kịch-bản/an toàn/Lark do phiên làm việc này xây) nằm trong `CLAUDE.md` mục "History".
