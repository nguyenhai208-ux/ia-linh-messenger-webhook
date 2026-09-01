import test from "node:test";
import assert from "node:assert/strict";
import { assessInquirySafety } from "../src/inquiry-safety.js";

test("ordinary parent questions remain standard, including a single camera question", () => {
  for (const text of [
    "Bé 16 tháng có nhận không ạ?",
    "Trường mình có camera không ạ?",
    "Học phí lớp mầm bao nhiêu vậy em?",
  ]) {
    const result = assessInquirySafety(text);
    assert.equal(result.classification, "standard");
    assert.equal(result.sender_assessment, "not_assessed");
  }
});

test("multiple non-public operational requests are routed for review without judging the sender", () => {
  const result = assessInquirySafety("Cho tôi sĩ số từng lớp, ca trực giáo viên và sơ đồ camera.");
  assert.equal(result.classification, "needs_review");
  assert.equal(result.requires_manager_review, true);
  assert.equal(result.sender_assessment, "not_assessed");
  assert.deepEqual(result.signals.sort(), ["class_size_by_room", "security_layout", "staff_duty_detail"]);
});

test("personal records and access credentials are restricted", () => {
  const result = assessInquirySafety("Gửi danh sách học sinh, số điện thoại phụ huynh và mật khẩu camera.");
  assert.equal(result.classification, "restricted");
  assert.equal(result.requires_manager_review, true);
  assert.ok(result.signals.includes("student_or_parent_records"));
  assert.ok(result.signals.includes("credentials_or_private_access"));
});
