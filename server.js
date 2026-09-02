import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { libraryMeta, suggest } from "./src/suggestion-engine.js";
import { larkBaseSyncEnabled, writeSuggestionToLark } from "./src/lark-base-sync.js";
import { redact } from "./src/redact.js";

const port = Number(process.env.PORT || 3000);
const verifyToken = process.env.VERIFY_TOKEN;
const appSecret = process.env.APP_SECRET;
const internalApiKey = process.env.INTERNAL_API_KEY;
// Facebook Login (staff dashboard auth) runs on the same Meta app as the
// Messenger webhook ("Chat bot"), so it reuses APP_SECRET unless overridden.
const facebookAppId = process.env.FACEBOOK_APP_ID || "2473856919758911";
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET || appSecret;
const facebookLoginConfigId = process.env.FACEBOOK_LOGIN_CONFIG_ID || "";
const publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://gia-linh-messenger-webhook.onrender.com";
const allowedStaffIds = new Set((process.env.STAFF_FACEBOOK_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));

if (!verifyToken || !appSecret || !internalApiKey) {
  console.error("Missing VERIFY_TOKEN, APP_SECRET, or INTERNAL_API_KEY.");
  process.exit(1);
}
if (!allowedStaffIds.size) {
  // Not fatal — but until STAFF_FACEBOOK_IDS is set, ANY Facebook account
  // that completes login can open the sales dashboard. Set this in the
  // hosting environment before real staff start using /assistant.
  console.warn("STAFF_FACEBOOK_IDS is empty: dashboard login is not restricted to staff yet.");
}

const recentSuggestions = [];
const maxRecentSuggestions = 100;
const sessionTtlMs = 8 * 60 * 60 * 1000;

function matches(a, b) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  return left.length === right.length && timingSafeEqual(left, right);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const parts = [];
    request.on("data", (part) => parts.push(part));
    request.on("end", () => resolve(Buffer.concat(parts)));
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
}

function isInternalRequest(request) {
  return matches(request.headers["x-internal-api-key"], internalApiKey);
}

function senderAlias(senderId) {
  return createHmac("sha256", appSecret).update(String(senderId || "")).digest("hex").slice(0, 12);
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
  }).filter(([name]) => name));
}

function sign(value) {
  return createHmac("sha256", appSecret).update(value).digest("hex");
}

function createSession(userId, expiresAt) {
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function hasValidSession(request) {
  const token = parseCookies(request).assistant_session;
  const [userId, expiresAt, signature] = String(token || "").split(".");
  if (!userId || !/^\d+$/.test(expiresAt || "") || Number(expiresAt) < Date.now()) return false;
  return matches(signature, sign(`${userId}.${expiresAt}`));
}

const SAFETY_LABEL = {
  standard: "Thông tin chuẩn",
  needs_review: "Cần quản lý xem xét",
  restricted: "Cần quản lý duyệt trước khi trả lời",
};

function page(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
    :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#152033;background:#f4f7fb}body{margin:0}.wrap{max-width:900px;margin:auto;padding:24px 16px}.card{background:#fff;border:1px solid #e3e9f1;border-radius:16px;padding:18px;margin:14px 0;box-shadow:0 2px 12px #1520330d}.muted{color:#667085;font-size:.9rem}.tag{display:inline-block;background:#eaf2ff;color:#175cd3;border-radius:999px;padding:4px 9px;font-size:.82rem;font-weight:600}.tag.warn{background:#fff4e5;color:#b54708}.tag.block{background:#fde8e8;color:#b42318}button{background:#155eef;color:#fff;border:0;border-radius:9px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer}input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}pre{white-space:pre-wrap;font:inherit;line-height:1.45;margin:10px 0 0}.row{display:flex;justify-content:space-between;gap:12px;align-items:center}.suggestion{border-top:1px dashed #e3e9f1;padding-top:10px;margin-top:10px}.suggestion:first-of-type{border-top:0;margin-top:0;padding-top:0}@media(max-width:560px){.wrap{padding:14px 10px}.card{padding:15px}.row{align-items:flex-start;flex-direction:column}}
  </style></head><body>${body}</body></html>`;
}

function loginPage(error = "") {
  const message = error ? `<p style="color:#b42318">${error}</p>` : "";
  return page("Đăng nhập trợ lý Messenger", `<main class="wrap" style="max-width:420px;padding-top:12vh"><section class="card"><h1>Trợ lý Messenger</h1><p class="muted">Gợi ý nội bộ cho nhân viên tuyển sinh.</p>${message}<p><a href="/auth/facebook"><button>Đăng nhập bằng Facebook</button></a></p></section></main>`);
}

function dashboardPage() {
  return page("Trợ lý Messenger", `<main class="wrap"><div class="row"><div><h1 style="margin-bottom:4px">Trợ lý Messenger</h1><p class="muted" style="margin-top:0">AI gợi ý tối đa 3 cách trả lời từ thư viện kịch bản đã duyệt · sale chọn, sửa hoặc bỏ qua trước khi gửi</p></div><form method="post" action="/assistant/logout"><button type="submit">Đăng xuất</button></form></div><section id="list" aria-live="polite"><div class="card">Đang tải gợi ý…</div></section></main><script>
  const escapeHtml=(value)=>String(value).replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\\"":"&quot;"}[c]));
  const safetyClass=(level)=>level==='restricted'?'block':level==='needs_review'?'warn':'';
  const safetyLabel=(level)=>({standard:'Thông tin chuẩn',needs_review:'Cần quản lý xem xét',restricted:'Cần quản lý duyệt trước khi trả lời'})[level]||'Cần sale kiểm tra';
  const suggestionBlock=(item)=>(item.suggestions||[]).map((s)=>'<div class="suggestion"><strong>'+escapeHtml(s.intent||'Gợi ý')+'</strong><pre>'+escapeHtml(s.reply)+'</pre><p><button data-copy="'+encodeURIComponent(s.reply)+'">Sao chép</button> <button data-edit="'+encodeURIComponent(s.reply)+'">Sửa & sao chép</button></p>'+(s.guardrail?'<p class="muted">'+escapeHtml(s.guardrail)+'</p>':'')+'</div>').join('');
  const card=(item)=>'<article class="card"><div class="row"><span class="tag '+safetyClass(item.classification)+'">'+escapeHtml(safetyLabel(item.classification))+'</span><time class="muted">'+escapeHtml(new Date(item.receivedAt).toLocaleString('vi-VN'))+'</time></div><p class="muted">Khách: '+escapeHtml(item.message)+'</p>'+suggestionBlock(item)+'<p><button disabled title="Chỉ bật sau khi cấu hình Meta Send API và quy tắc duyệt">Gửi qua Meta</button></p></article>';
  async function render(){const response=await fetch('/assistant/recent',{headers:{accept:'application/json'}});if(response.status===401){location='/assistant';return}const data=await response.json();const list=document.querySelector('#list');list.innerHTML=data.items.length?data.items.map(card).join(''):'<div class="card">Chưa có gợi ý mới.</div>';document.querySelectorAll('[data-copy]').forEach((button)=>button.onclick=async()=>{await navigator.clipboard.writeText(decodeURIComponent(button.dataset.copy));button.textContent='Đã sao chép';setTimeout(()=>button.textContent='Sao chép',1200)});document.querySelectorAll('[data-edit]').forEach((button)=>button.onclick=async()=>{const edited=prompt('Sửa gợi ý trước khi sao chép',decodeURIComponent(button.dataset.edit));if(edited===null)return;await navigator.clipboard.writeText(edited);button.textContent='Đã sao chép bản sửa';setTimeout(()=>button.textContent='Sửa & sao chép',1200)});}
  render();setInterval(render,10000);
  </script>`);
}

function recordIncomingEvent(payload) {
  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text;
      if (!text || event.message?.is_echo) continue;
      const result = suggest(text);
      const item = {
        id: `MSG-AI-${randomUUID().slice(0, 8).toUpperCase()}`,
        receivedAt: new Date().toISOString(),
        sender: senderAlias(event.sender?.id),
        message: redact(text),
        classification: result.inquiry_safety.classification,
        requiresManagerReview: result.inquiry_safety.requires_manager_review,
        suggestions: result.suggestions,
      };
      recentSuggestions.unshift(item);
      recentSuggestions.length = Math.min(recentSuggestions.length, maxRecentSuggestions);
      console.info(JSON.stringify({ event: "messenger_suggestion_ready", id: item.id, classification: item.classification }));
      if (larkBaseSyncEnabled) {
        // Fire-and-forget: Meta expects a fast ack, and a failed Lark write
        // must never block or fail the webhook response.
        writeSuggestionToLark({ text, result })
          .then((lark) => console.info(JSON.stringify({ event: "lark_sync", id: item.id, ...lark })))
          .catch((error) => console.error(JSON.stringify({ event: "lark_sync_failed", id: item.id, reason: String(error?.message || error) })));
      }
    }
  }
}

export const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/assistant" && request.method === "GET") {
    if (!hasValidSession(request)) return response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(loginPage());
    return response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(dashboardPage());
  }

  if (url.pathname === "/auth/facebook" && request.method === "GET") {
    const state = randomBytes(24).toString("hex");
    const redirectUri = `${publicBaseUrl}/auth/facebook/callback`;
    const loginUrl = new URL("https://www.facebook.com/v24.0/dialog/oauth");
    loginUrl.searchParams.set("client_id", facebookAppId);
    loginUrl.searchParams.set("redirect_uri", redirectUri);
    loginUrl.searchParams.set("state", state);
    loginUrl.searchParams.set("response_type", "code");
    if (facebookLoginConfigId) {
      loginUrl.searchParams.set("config_id", facebookLoginConfigId);
      loginUrl.searchParams.set("override_default_response_type", "true");
    } else {
      loginUrl.searchParams.set("scope", "public_profile");
    }
    // SameSite=Lax (not Strict): this cookie must survive the top-level
    // cross-site GET redirect Facebook sends back to /auth/facebook/callback.
    // Strict is elided on cross-site top-level navigation, which broke every
    // login with a generic "not_allowed" (state never matched).
    return response.writeHead(302, { "Set-Cookie": `assistant_oauth_state=${state}.${sign(state)}; HttpOnly; Secure; SameSite=Lax; Path=/auth/facebook; Max-Age=600`, Location: loginUrl.toString() }).end();
  }

  if (url.pathname === "/auth/facebook/callback" && request.method === "GET") {
    try {
      const state = url.searchParams.get("state") || "";
      const [savedState, signature] = String(parseCookies(request).assistant_oauth_state || "").split(".");
      if (!state || !matches(state, savedState) || !matches(signature, sign(savedState))) throw new Error("invalid_state");
      const redirectUri = `${publicBaseUrl}/auth/facebook/callback`;
      const tokenUrl = new URL("https://graph.facebook.com/v24.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", facebookAppId);
      tokenUrl.searchParams.set("client_secret", facebookAppSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", url.searchParams.get("code") || "");
      const token = await (await fetch(tokenUrl)).json();
      const profile = await (await fetch(`https://graph.facebook.com/v24.0/me?fields=id&access_token=${encodeURIComponent(token.access_token || "")}`)).json();
      if (!profile.id || (allowedStaffIds.size && !allowedStaffIds.has(String(profile.id)))) throw new Error("not_allowed");
      if (!allowedStaffIds.size) console.info(JSON.stringify({ event: "dashboard_bootstrap_login", facebookId: String(profile.id) }));
      const expiresAt = Date.now() + sessionTtlMs;
      return response.writeHead(303, { "Set-Cookie": `assistant_session=${encodeURIComponent(createSession(profile.id, expiresAt))}; HttpOnly; Secure; SameSite=Strict; Path=/assistant; Max-Age=${sessionTtlMs / 1000}`, Location: "/assistant" }).end();
    } catch (error) {
      console.error(JSON.stringify({ event: "dashboard_login_failed", reason: String(error?.message || "unknown") }));
      return response.writeHead(403, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(loginPage("Tài khoản Facebook này chưa được cấp quyền."));
    }
  }

  if (url.pathname === "/assistant/logout" && request.method === "POST") {
    return response.writeHead(303, { "Set-Cookie": "assistant_session=; HttpOnly; Secure; SameSite=Strict; Path=/assistant; Max-Age=0", Location: "/assistant" }).end();
  }

  if (url.pathname === "/assistant/recent" && request.method === "GET") {
    if (!hasValidSession(request)) return json(response, 401, { error: "Unauthorized" });
    return json(response, 200, { items: recentSuggestions });
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json(response, 200, {
      ok: true,
      library: libraryMeta,
      outbound_sending: false,
      lark_base_sync: larkBaseSyncEnabled,
      retained_suggestions: recentSuggestions.length,
      staff_dashboard_restricted: allowedStaffIds.size > 0,
    });
  }

  if (request.method === "POST" && url.pathname === "/suggestions") {
    if (!isInternalRequest(request)) return json(response, 401, { error: "Unauthorized" });
    try {
      const payload = JSON.parse((await readBody(request)).toString("utf8"));
      const result = suggest(payload.text, { limit: payload.limit });
      // Sync is opt-in per request and globally disabled unless explicitly enabled.
      const lark = payload.sync_to_lark === true ? await writeSuggestionToLark({ text: payload.text, result }) : { synced: false, reason: "not_requested" };
      return json(response, 200, { ...result, lark });
    } catch (error) {
      return json(response, 400, { error: error.message || "Invalid request" });
    }
  }

  if (url.pathname !== "/webhook") return response.writeHead(404).end("Not found");

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge && matches(token, verifyToken)) {
      return response.writeHead(200, { "Content-Type": "text/plain" }).end(challenge);
    }
    return response.writeHead(403).end("Verification failed");
  }

  if (request.method === "POST") {
    try {
      const rawBody = await readBody(request);
      const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
      if (!matches(expected, request.headers["x-hub-signature-256"])) {
        return response.writeHead(401).end("Invalid signature");
      }
      const payload = JSON.parse(rawBody.toString("utf8"));
      recordIncomingEvent(payload);
      return response.writeHead(200).end("EVENT_RECEIVED");
    } catch {
      return response.writeHead(400).end("Invalid request");
    }
  }
  return response.writeHead(405).end("Method not allowed");
});

if (!process.env.TEST_MODE) server.listen(port, () => console.info(`Messenger webhook listening on port ${port}`));
