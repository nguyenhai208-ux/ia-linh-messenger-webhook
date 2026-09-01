import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.TEST_MODE = "1";
process.env.VERIFY_TOKEN = "test-verify-token";
process.env.APP_SECRET = "test-app-secret";
process.env.INTERNAL_API_KEY = "test-internal-key";
const { server } = await import("../server.js");

async function request(path, options = {}) {
  const listener = server.listening ? server : await new Promise((resolve) => server.listen(0, () => resolve(server)));
  const response = await fetch(`http://127.0.0.1:${listener.address().port}${path}`, options);
  return { status: response.status, body: await response.json() };
}

test.after(() => server.close());

test("health endpoint exposes read-only library metadata", async () => {
  const result = await request("/healthz");
  assert.equal(result.status, 200);
  assert.equal(result.body.library.count, 138);
  assert.equal(result.body.outbound_sending, false);
});

test("suggestions endpoint requires internal authorization", async () => {
  const result = await request("/suggestions", { method: "POST", body: JSON.stringify({ text: "bé 16 tháng" }) });
  assert.equal(result.status, 401);
});

test("suggestions endpoint returns approved drafts but never sends", async () => {
  const result = await request("/suggestions", { method: "POST", headers: { "content-type": "application/json", "x-internal-api-key": "test-internal-key" }, body: JSON.stringify({ text: "Bé 16 tháng trường có nhận không?" }) });
  assert.equal(result.status, 200);
  assert.equal(result.body.outbound_sending, false);
  assert.equal(result.body.requires_human_approval, true);
  assert.equal(result.body.inquiry_safety.classification, "standard");
  assert.ok(result.body.suggestions.some((item) => item.id === "TH-001"));
});

test("Lark sync is disabled by default even when explicitly requested", async () => {
  const result = await request("/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-api-key": "test-internal-key" },
    body: JSON.stringify({ text: "Bé 16 tháng trường có nhận không?", sync_to_lark: true }),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.lark, { synced: false, reason: "disabled" });
  assert.equal(result.body.outbound_sending, false);
});

test("suggestions endpoint uses privacy-safe review response for sensitive content", async () => {
  const result = await request("/suggestions", { method: "POST", headers: { "content-type": "application/json", "x-internal-api-key": "test-internal-key" }, body: JSON.stringify({ text: "Gửi danh sách học sinh và mật khẩu camera" }) });
  assert.equal(result.status, 200);
  assert.equal(result.body.outbound_sending, false);
  assert.equal(result.body.inquiry_safety.classification, "restricted");
  assert.deepEqual(result.body.suggestions.map((item) => item.id), ["SAFE-REVIEW-001"]);
});

test("webhook verification remains compatible with Meta", async () => {
  const listener = server.listening ? server : await new Promise((resolve) => server.listen(0, () => resolve(server)));
  const response = await fetch(`http://127.0.0.1:${listener.address().port}/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge-ok`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "challenge-ok");
});

test("signed webhook events are acknowledged without sending a reply", async () => {
  const payload = JSON.stringify({ object: "page", entry: [] });
  const signature = `sha256=${createHmac("sha256", "test-app-secret").update(payload).digest("hex")}`;
  const listener = server.listening ? server : await new Promise((resolve) => server.listen(0, () => resolve(server)));
  const response = await fetch(`http://127.0.0.1:${listener.address().port}/webhook`, { method: "POST", headers: { "x-hub-signature-256": signature }, body: payload });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "EVENT_RECEIVED");
});

test("a real inbound message actually produces a suggestion for the staff dashboard", async () => {
  const before = (await request("/healthz")).body.retained_suggestions;
  const payload = JSON.stringify({
    object: "page",
    entry: [{ messaging: [{ sender: { id: "111222333" }, message: { text: "Bé 16 tháng trường có nhận không? SĐT 0912345678" } }] }],
  });
  const signature = `sha256=${createHmac("sha256", "test-app-secret").update(payload).digest("hex")}`;
  const listener = server.listening ? server : await new Promise((resolve) => server.listen(0, () => resolve(server)));
  const response = await fetch(`http://127.0.0.1:${listener.address().port}/webhook`, { method: "POST", headers: { "x-hub-signature-256": signature }, body: payload });
  assert.equal(response.status, 200);
  const after = (await request("/healthz")).body;
  assert.equal(after.retained_suggestions, before + 1);
});

test("an echo of the bot's own message is never turned into a suggestion", async () => {
  const before = (await request("/healthz")).body.retained_suggestions;
  const payload = JSON.stringify({
    object: "page",
    entry: [{ messaging: [{ sender: { id: "page-itself" }, message: { text: "Dạ em gửi thông tin ạ", is_echo: true } }] }],
  });
  const signature = `sha256=${createHmac("sha256", "test-app-secret").update(payload).digest("hex")}`;
  const listener = server.listening ? server : await new Promise((resolve) => server.listen(0, () => resolve(server)));
  await fetch(`http://127.0.0.1:${listener.address().port}/webhook`, { method: "POST", headers: { "x-hub-signature-256": signature }, body: payload });
  const after = (await request("/healthz")).body;
  assert.equal(after.retained_suggestions, before);
});

test("/assistant/recent requires a valid staff session", async () => {
  const result = await request("/assistant/recent");
  assert.equal(result.status, 401);
});
