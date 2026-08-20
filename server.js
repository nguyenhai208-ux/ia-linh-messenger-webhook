import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const verifyToken = process.env.VERIFY_TOKEN;
const appSecret = process.env.APP_SECRET;
if (!verifyToken || !appSecret) process.exit(1);

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
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
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
      console.info(JSON.stringify({ event: "messenger_webhook_received", receivedAt: new Date().toISOString() }));
      return response.writeHead(200).end("EVENT_RECEIVED");
    } catch { return response.writeHead(400).end("Invalid request"); }
  }
  return response.writeHead(405).end("Method not allowed");
});
server.listen(port, () => console.info(`Messenger webhook listening on port ${port}`));
