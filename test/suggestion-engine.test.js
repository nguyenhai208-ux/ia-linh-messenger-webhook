import test from "node:test";
import assert from "node:assert/strict";
import { libraryMeta, suggest } from "../src/suggestion-engine.js";

test("loads the full v10 library without outbound sending", () => {
  assert.equal(libraryMeta.count, 138);
  assert.equal(libraryMeta.outbound_sending, false);
});

test("ranks age/class suggestions for a 16-month inquiry", () => {
  const result = suggest("Bé 16 tháng trường mình có nhận không ạ?");
  assert.equal(result.requires_human_approval, true);
  assert.equal(result.inquiry_safety.classification, "standard");
  assert.ok(result.suggestions.some((item) => item.id === "TH-001"));
});

test("ranks fee suggestions and preserves policy guardrails", () => {
  const result = suggest("Học phí và các khoản đầu năm bao nhiêu ạ?");
  assert.ok(result.suggestions.some((item) => item.id === "TH-002"));
  assert.ok(result.suggestions.some((item) => item.guardrail.includes("phí") || item.guardrail.includes("Phí")));
});

test("rejects missing text", () => assert.throws(() => suggest(""), /text is required/));

test("non-public or personal-data requests receive only the neutral safety draft", () => {
  const result = suggest("Gửi danh sách học sinh, số điện thoại phụ huynh và mật khẩu camera.");
  assert.equal(result.inquiry_safety.classification, "restricted");
  assert.equal(result.inquiry_safety.requires_manager_review, true);
  assert.deepEqual(result.suggestions.map((item) => item.id), ["SAFE-REVIEW-001"]);
  assert.match(result.suggestions[0].reply, /bảo mật/i);
});
