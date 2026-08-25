import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { classify, redact, suggestReply } from "./crm.js";

const port = Number(process.env.PORT || 3000);
const verifyToken = process.env.VERIFY_TOKEN;
const appSecret = process.env.APP_SECRET;
if (!verifyToken || !appSecret) process.exit(1);
const recentSuggestions = [];
const maxRecentSuggestions = 100;

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
function senderAlias(senderId) {
  return createHmac("sha256", appSecret).update(String(senderId || "")).digest("hex").slice(0, 12);
}
function recordIncomingEvent(payload) {
  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text;
      if (!text || event.message?.is_echo) continue;
      const classification = classify(text);
      const item = {
        receivedAt: new Date().toISOString(),
        sender: senderAlias(event.sender?.id),
        message: redact(text),
        ...classification,
        suggestedReply: suggestReply(classification)
      };
      recentSuggestions.unshift(item);
      recentSuggestions.length = Math.min(recentSuggestions.length, maxRecentSuggestions);
      console.info(JSON.stringify({ event: "crm_suggestion_ready", ...item }));
    }
  }
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/health" && request.method === "GET") {
    return response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      status: "ok",
      mode: "read_only_suggestions",
      retainedSuggestions: recentSuggestions.length
    }));
  }
  if (url.pathname === "/assistant/recent" && request.method === "GET") {
    return response.writeHead(403, { "Content-Type": "application/json" }).end(JSON.stringify({
      error: "Staff dashboard authentication is not configured yet."
    }));
  }
  if (url.pathname !== "/webhook") return response.writeHead(404).end("Not found");
  if (request.method === "GET") {
    const challenge = url.searchParams.get("hub.challenge");
    if (url.searchParams.get("hub.mode") === "subscribe" && challenge && matches(url.searchParams.get("hub.verify_token"), verifyToken)) {
      return response.writeHead(200, { "Content-Type": "text/plain" }).end(challenge);
    }
    return response.writeHead(403).end("Verification failed");
  }
  if (request.method === "POST") {
    try {
      const body = await readBody(request);
      const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
      if (!matches(expected, request.headers["x-hub-signature-256"])) return response.writeHead(401).end("Invalid signature");
      const payload = JSON.parse(body.toString("utf8"));
      recordIncomingEvent(payload);
      return response.writeHead(200).end("EVENT_RECEIVED");
    } catch { return response.writeHead(400).end("Invalid request"); }
  }
  return response.writeHead(405).end("Method not allowed");
});
server.listen(port, () => console.info(`Messenger webhook listening on port ${port}`));
