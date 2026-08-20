import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const verifyToken = process.env.VERIFY_TOKEN;
const appSecret = process.env.APP_SECRET;

if (!verifyToken || !appSecret) {
  console.error("Missing VERIFY_TOKEN or APP_SECRET. Copy .env.example to .env and set both values.");
  process.exit(1);
}

function matches(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signatureIsValid(rawBody, header) {
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return matches(expected, header);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function receiveEvent(payload) {
  // Intentionally store nothing in this first version. This avoids retaining
  // parent and child data until the approved database and access rules exist.
  const entries = Array.isArray(payload.entry) ? payload.entry.length : 0;
  console.info(JSON.stringify({ event: "messenger_webhook_received", entries, receivedAt: new Date().toISOString() }));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== "/webhook") {
    response.writeHead(404).end("Not found");
    return;
  }

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge && matches(token, verifyToken)) {
      response.writeHead(200, { "Content-Type": "text/plain" }).end(challenge);
      return;
    }
    response.writeHead(403).end("Verification failed");
    return;
  }

  if (request.method === "POST") {
    try {
      const rawBody = await readBody(request);
      if (!signatureIsValid(rawBody, request.headers["x-hub-signature-256"])) {
        response.writeHead(401).end("Invalid signature");
        return;
      }
      receiveEvent(JSON.parse(rawBody.toString("utf8")));
      response.writeHead(200).end("EVENT_RECEIVED");
    } catch {
      response.writeHead(400).end("Invalid request");
    }
    return;
  }

  response.writeHead(405).end("Method not allowed");
});

server.listen(port, () => console.info(`Messenger webhook listening on port ${port}`));
