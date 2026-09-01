// This classifier evaluates only the content requested in one message.  It must
// never infer intent from an account's name, profile, location, age, connections,
// or other identity attributes.  A "needs_review" outcome is not a finding about
// the sender; it is only a cue to protect non-public operational information.

const RESTRICTED_PATTERNS = [
  ["student_or_parent_records", /(?:danh\s*sach|thong\s*tin|ho\s*so).{0,45}(?:hoc\s*sinh|tre|phu\s*huynh)|(?:hoc\s*sinh|phu\s*huynh).{0,35}(?:so\s*dien\s*thoai|dia\s*chi|ho\s*so)/i],
  ["credentials_or_private_access", /(?:mat\s*khau|tai\s*khoan|link\s*truy\s*cap|quyen\s*truy\s*cap).{0,45}(?:camera|he\s*thong|cctv|phan\s*mem)|(?:camera|cctv).{0,35}(?:truc\s*tiep|dang\s*nhap|mat\s*khau|link)/i],
  ["staff_personal_data", /(?:so\s*dien\s*thoai|dia\s*chi|ho\s*so|luong).{0,35}(?:giao\s*vien|nhan\s*su|bao\s*ve)|(?:giao\s*vien|nhan\s*su|bao\s*ve).{0,35}(?:so\s*dien\s*thoai|dia\s*chi|ho\s*so|luong)/i],
];

const REVIEW_PATTERNS = [
  ["class_size_by_room", /si\s*so.{0,24}(?:tung\s*lop|moi\s*lop|chi\s*tiet)/i],
  ["staff_duty_detail", /(?:ca\s*truc|lich\s*truc).{0,35}(?:giao\s*vien|bao\s*ve|nhan\s*su)|(?:giao\s*vien|bao\s*ve|nhan\s*su).{0,35}(?:ca\s*truc|lich\s*truc)/i],
  ["security_layout", /(?:so\s*do|vi\s*tri).{0,35}(?:camera|cctv|bao\s*ve|an\s*ninh)/i],
  ["internal_process", /(?:quy\s*trinh|bao\s*cao|chi\s*phi|ke\s*hoach).{0,20}noi\s*bo|noi\s*bo.{0,20}(?:quy\s*trinh|bao\s*cao|chi\s*phi|ke\s*hoach)/i],
  ["staff_list_or_contract", /(?:danh\s*sach\s*giao\s*vien|ho\s*so\s*nhan\s*su|hop\s*dong\s*(?:giao\s*vien|nhan\s*su))/i],
];

export const SAFETY_DRAFT = Object.freeze({
  id: "SAFE-REVIEW-001",
  intent: "Yêu cầu thông tin chưa công khai/cần xác minh",
  reply: "Dạ để bảo đảm an toàn và bảo mật cho trẻ, phụ huynh và đội ngũ, em chỉ có thể hỗ trợ các thông tin tuyển sinh công khai hoặc đã được phê duyệt. Nội dung cần xác minh, em xin phép chuyển quản lý phụ trách phản hồi chính thức ạ.",
  follow_up_questions: "Nếu ba/mẹ đang tìm trường cho bé, em có thể hỗ trợ ngay về độ tuổi, cơ sở, thời điểm dự kiến đi học và lịch tham quan.",
  guardrail: "Không cung cấp dữ liệu cá nhân, thông tin truy cập, sơ đồ an ninh hoặc tài liệu vận hành nội bộ. Không suy đoán danh tính/nghề nghiệp/mục đích của người nhắn.",
  source_type: "safety-policy",
});

function compact(text) {
  return String(text || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function assessInquirySafety(text) {
  const normalized = compact(text);
  const restrictedSignals = RESTRICTED_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([id]) => id);
  if (restrictedSignals.length) {
    return {
      classification: "restricted",
      signals: restrictedSignals,
      requires_manager_review: true,
      content_sharing: "public_or_approved_only",
      sender_assessment: "not_assessed",
    };
  }

  const reviewSignals = REVIEW_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([id]) => id);
  if (reviewSignals.length >= 2) {
    return {
      classification: "needs_review",
      signals: reviewSignals,
      requires_manager_review: true,
      content_sharing: "public_or_approved_only",
      sender_assessment: "not_assessed",
    };
  }

  return {
    classification: "standard",
    signals: [],
    requires_manager_review: false,
    content_sharing: "normal_sales_review",
    sender_assessment: "not_assessed",
  };
}
