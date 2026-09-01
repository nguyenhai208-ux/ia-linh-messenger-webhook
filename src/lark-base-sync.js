import { randomUUID } from "node:crypto";
import { redact } from "./redact.js";

const appId = process.env.LARK_APP_ID;
const appSecret = process.env.LARK_APP_SECRET;
// Deliberately hard-coded allowlist. This connector cannot be redirected to
// any legacy Base/table through environment configuration.
const appToken = "MOqwbuHCaa00cAskjDRljqYUggd";
// tbl3FxaqNVXUXhcN is "Messenger AI – Thử nghiệm". Do not point this at
// "Bảng" (tbl6dJjA1iQvS4V0) or any other existing table in this Base.
const tableId = "tbl3FxaqNVXUXhcN";

export const larkBaseSyncEnabled = process.env.LARK_BASE_SYNC_ENABLED === "true";

function configured() {
  return Boolean(appId && appSecret);
}

async function tenantAccessToken() {
  const response = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const body = await response.json();
  if (!response.ok || body.code !== 0 || !body.tenant_access_token) {
    throw new Error(`Lark token request failed (${body.code ?? response.status})`);
  }
  return body.tenant_access_token;
}

export async function writeSuggestionToLark({ text, result }) {
  if (!larkBaseSyncEnabled) return { synced: false, reason: "disabled" };
  if (!configured()) throw new Error("Lark Base sync is enabled but not fully configured");

  const token = await tenantAccessToken();
  const top = result.suggestions?.[0] || {};
  const fields = {
    "Văn bản": `MSG-AI-${randomUUID().slice(0, 8).toUpperCase()}`,
    "Thời điểm nhận": new Date().toISOString(),
    "Nội dung (đã ẩn)": redact(text),
    "Ý định AI": String(top.intent || result.inquiry_safety?.classification || "Chưa phân loại").slice(0, 1000),
    "Gợi ý AI": String(top.reply || "Cần quản lý duyệt").slice(0, 5000),
    "Trạng thái duyệt": "Chờ duyệt",
  };
  const response = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ fields }),
  });
  const body = await response.json();
  if (!response.ok || body.code !== 0 || !body.data?.record?.record_id) {
    throw new Error(`Lark record create failed (${body.code ?? response.status})`);
  }
  return { synced: true, record_id: body.data.record.record_id };
}
