const admissionsSignals = [
  "học phí", "học thử", "nhập học", "tuyển sinh", "đăng ký", "đăng kí",
  "cho bé", "con tôi", "lớp", "mầm non", "mẫu giáo", "trường", "tham quan",
  "cơ sở", "giữ chỗ", "đón", "trả", "bán trú", "thứ bảy", "thứ 7",
  "sinh năm", "bao nhiêu tuổi", "chương trình", "ăn", "ngủ", "xe đưa đón"
];
const recruitmentSignals = [
  "tuyển dụng", "ứng tuyển", "xin việc", "việc làm", "cv", "hồ sơ",
  "phỏng vấn", "lương", "giáo viên", "trợ giảng", "nhân viên", "thực tập"
];

const intentRules = [
  { intent: "hoc_phi", label: "Học phí / ưu đãi", words: ["học phí", "chi phí", "giá", "đóng tiền", "ưu đãi", "khuyến mãi"] },
  { intent: "do_tuoi_lop", label: "Độ tuổi / lớp học", words: ["sinh năm", "bao nhiêu tuổi", "mấy tuổi", "lớp nào", "độ tuổi"] },
  { intent: "tham_quan", label: "Tham quan trường", words: ["tham quan", "đến trường", "xem trường", "hẹn gặp"] },
  { intent: "hoc_thu", label: "Học thử / làm quen", words: ["học thử", "trải nghiệm", "làm quen", "thử học"] },
  { intent: "co_so_di_lai", label: "Cơ sở / đưa đón", words: ["cơ sở", "địa chỉ", "đưa đón", "xe", "gần", "khu vực"] },
  { intent: "lich_hoc", label: "Lịch học / thời điểm nhập học", words: ["khi nào", "lịch học", "thứ bảy", "thứ 7", "nhập học", "bắt đầu"] },
  { intent: "cham_soc_an_toan", label: "Chăm sóc / an toàn", words: ["ăn", "ngủ", "dị ứng", "sức khỏe", "an toàn", "y tế"] },
  { intent: "chuong_trinh", label: "Chương trình học", words: ["chương trình", "tiếng anh", "hoạt động", "phương pháp"] }
];

const qualificationSignals = [
  "tháng", "tuổi", "sinh năm", "cơ sở", "khu vực", "dự kiến", "nhập học",
  "tham quan", "đến trường", "bé nhà", "con tôi", "con em", "con nhà"
];

const controlledInformationSignals = [
  "học phí", "chi phí", "giá", "đơn giá", "đóng tiền", "ưu đãi", "khuyến mãi",
  "giảm giá", "giữ chỗ", "đặt cọc", "hoàn phí", "thanh toán", "hợp đồng",
  "sĩ số", "tỷ lệ", "camera", "quy trình", "lương", "doanh thu"
];

export function redact(text = "") {
  return String(text)
    .replace(/(?:\\+?84|0)(?:[ .-]?\\d){8,10}/g, "[SĐT]")
    .replace(/\\b\\d{8,14}\\b/g, "[SỐ]");
}

export function classify(text = "") {
  const normalized = String(text).toLocaleLowerCase("vi-VN");
  const score = (list) => list.reduce((total, word) => total + (normalized.includes(word) ? 1 : 0), 0);
  const admissionScore = score(admissionsSignals);
  const recruitmentScore = score(recruitmentSignals);
  const qualificationScore = score(qualificationSignals);
  const controlledInformationScore = score(controlledInformationSignals);
  const accessLevel = controlledInformationScore > 0 && qualificationScore < 2
    ? "needs_qualification"
    : controlledInformationScore > 0
      ? "verify_current_policy"
      : "standard";
  const accessNote = accessLevel === "needs_qualification"
    ? "Chỉ gợi ý thông tin khái quát; xin thêm tuổi bé, cơ sở hoặc thời điểm dự kiến trước khi đưa số liệu/chính sách chi tiết."
    : accessLevel === "verify_current_policy"
      ? "Có thể gợi ý nội dung chi tiết sau khi sale đối chiếu bảng phí/chính sách hiện hành."
      : "Có thể dùng gợi ý chuẩn; sale vẫn kiểm tra ngữ cảnh trước khi gửi.";
  if (recruitmentScore > admissionScore && recruitmentScore > 0) {
    return { audience: "recruitment", intent: "tuyen_dung", intentLabel: "Tuyển dụng", accessLevel, accessNote };
  }
  if (admissionScore > 0) {
    const matched = intentRules.find((rule) => rule.words.some((word) => normalized.includes(word)));
    return {
      audience: "admissions",
      intent: matched?.intent || "tu_van_chung",
      intentLabel: matched?.label || "Tư vấn tuyển sinh chung",
      accessLevel,
      accessNote
    };
  }
  return { audience: "unclear", intent: "phan_loai", intentLabel: "Cần xác định nhu cầu", accessLevel, accessNote };
}

export function suggestReply(classification) {
  if (classification.accessLevel === "needs_qualification") {
    return "Dạ để gửi thông tin phù hợp và chính xác, anh/chị cho em xin tháng/năm sinh của bé, cơ sở hoặc khu vực quan tâm và thời điểm dự kiến đi học ạ. Em sẽ kiểm tra đúng thông tin rồi phản hồi mình ngay.";
  }
  if (classification.audience === "recruitment") {
    return "Dạ, cảm ơn anh/chị đã quan tâm cơ hội việc làm tại Gia Linh FNG. Anh/chị cho em xin vị trí mong muốn, cơ sở thuận tiện và CV hoặc số điện thoại để bộ phận tuyển dụng phản hồi đúng thông tin ạ.";
  }
  if (classification.audience === "unclear") {
    return "Dạ, anh/chị đang quan tâm đăng ký cho bé đi học hay muốn tìm hiểu cơ hội việc làm tại trường ạ? Em hỗ trợ đúng thông tin cho mình nhé.";
  }
  const byIntent = {
    hoc_phi: "Dạ, để tư vấn mức phí và chính sách đúng thời điểm, anh/chị cho em xin tháng/năm sinh của bé, cơ sở quan tâm và thời gian dự kiến nhập học ạ. Em kiểm tra chính sách hiện hành rồi phản hồi mình ngay.",
    do_tuoi_lop: "Dạ, anh/chị cho em xin tháng/năm sinh của bé và cơ sở mình quan tâm nhé. Em sẽ kiểm tra lớp phù hợp, tình trạng chỗ và lộ trình làm quen cho bé ạ.",
    tham_quan: "Dạ, nhà trường rất sẵn sàng đón gia đình tham quan. Anh/chị cho em xin cơ sở thuận tiện, ngày/khung giờ mong muốn và tháng/năm sinh của bé để em kiểm tra lịch tiếp đón ạ.",
    hoc_thu: "Dạ, để sắp xếp buổi làm quen phù hợp, anh/chị cho em xin tháng/năm sinh của bé, cơ sở quan tâm và thời gian gia đình thuận tiện ạ. Em kiểm tra lịch lớp rồi xác nhận lại mình.",
    co_so_di_lai: "Dạ, anh/chị cho em xin khu vực nhà mình, tháng/năm sinh của bé và nhu cầu đưa đón (nếu có) nhé. Em sẽ đối chiếu cơ sở/lớp phù hợp rồi tư vấn chính xác ạ.",
    lich_hoc: "Dạ, anh/chị cho em xin thời điểm dự kiến cho bé đi học, tháng/năm sinh và cơ sở quan tâm nhé. Em kiểm tra lịch hoạt động và tình trạng lớp phù hợp cho mình ạ.",
    cham_soc_an_toan: "Dạ, nhà trường sẽ tư vấn theo nhu cầu riêng của bé. Anh/chị cho em biết thêm tháng/năm sinh, cơ sở quan tâm và lưu ý về sức khỏe/chế độ ăn (nếu có) để em trao đổi đúng với bộ phận chuyên môn ạ.",
    chuong_trinh: "Dạ, anh/chị cho em xin tháng/năm sinh của bé và cơ sở quan tâm. Em sẽ gửi thông tin chương trình phù hợp theo độ tuổi và sắp xếp tư vấn cụ thể cho gia đình ạ.",
    tu_van_chung: "Dạ, anh/chị cho em xin tháng/năm sinh của bé, cơ sở quan tâm và nhu cầu chính của gia đình nhé. Em kiểm tra thông tin phù hợp rồi tư vấn cụ thể cho mình ạ."
  };
  return byIntent[classification.intent] || byIntent.tu_van_chung;
}
