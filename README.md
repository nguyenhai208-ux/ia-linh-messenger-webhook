# Messenger webhook – Gia Linh FNG

This service receives real Messenger events from the Fanpage, generates up to three draft replies from the approved script library, and shows them to sales staff on an internal dashboard. It never sends a message itself.

## What it does

- Answers Meta's `GET /webhook` verification challenge and validates every `POST /webhook` payload with `X-Hub-Signature-256`.
- On each real inbound customer message, ranks it against the 138-script v10 library and produces up to three drafts, each guarded by `src/inquiry-safety.js`, which judges only the message text — never sender identity, name, avatar, account age, or any Messenger profile attribute.
- Serves a staff dashboard at `/assistant`, gated by "Đăng nhập bằng Facebook" (Facebook Login on the same Meta app as the webhook). Staff see the redacted customer message, the safety classification, and the draft(s); they copy, edit-and-copy, or discard — there is no send button.
- When a message asks for personal records, credentials/access, or several detailed non-public operational items, it substitutes the neutral `SAFE-REVIEW-001` draft and flags it for manager review instead of guessing.
- When `LARK_BASE_SYNC_ENABLED=true`, every real inbound message is also persisted to the `Messenger AI – Thử nghiệm` table (see below) with status `Chờ duyệt`, independent of the in-memory dashboard list.
- Exposes an internal, authenticated `POST /suggestions` for manually generating a draft outside the live Messenger flow (e.g. for testing scripts or a future CRM integration).
- Exposes `GET /healthz` for deployment checks — reports library version, `outbound_sending: false`, whether Lark sync is on, and how many suggestions are held in memory.

## What it deliberately does not do

- It does not send messages to Messenger — there is no send endpoint anywhere in this codebase.
- It does not use historic fees, discounts, availability, schedules, or trial policies as current facts: each draft includes a guardrail for the sales reviewer.
- It does not use account age, name, avatar, friends/followers, location, or any inferred identity to decide how a person is treated.
- The in-memory dashboard list (`/assistant/recent`) is capped at 100 items and is **not** durable — it resets on every deploy/restart. The Lark Base sync is the durable audit trail; keep `LARK_BASE_SYNC_ENABLED=true` in any environment that needs a permanent record.

## Run locally

1. Use Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in `VERIFY_TOKEN`, `APP_SECRET` (the **Chat bot** Meta app's real secret — 32 hex chars), `INTERNAL_API_KEY`, and the `STAFF_FACEBOOK_IDS` you want to allow into the dashboard.
3. Run `npm run dev` (loads `.env` via `node --env-file`). Use `npm start` to mirror how the hosting platform runs it — that script does **not** read `.env`, so it will fail fast locally unless the same variables are exported in the shell; this is intentional, since the deployed environment has no `.env` file and injects variables through its own dashboard.

Meta requires the callback URL to be a public HTTPS endpoint pointing at `/webhook`, with the **same** `VERIFY_TOKEN` value entered as Meta's "Xác minh mã".

## Staff dashboard auth

Facebook Login runs against the **Chat bot** Meta app (`2473856919758911`), the same app the Messenger webhook is registered on — `FACEBOOK_APP_SECRET` therefore defaults to `APP_SECRET` unless overridden. `PUBLIC_BASE_URL` must match the deployed URL exactly (it's used as the OAuth `redirect_uri`). `STAFF_FACEBOOK_IDS` is a comma-separated allowlist of Facebook user IDs; **while it's empty, any Facebook account that completes login can open `/assistant`** — set it before real staff start using the dashboard.

## Internal suggestion API

`POST /suggestions` requires header `X-Internal-API-Key` and a JSON body such as `{"text":"Bé 16 tháng trường có nhận không?","limit":3}`. `inquiry_safety.classification` is `standard`, `needs_review`, or `restricted` — the latter two return the neutral `SAFE-REVIEW-001` draft and require manager review before any tailored reply. Lark sync on this endpoint is opt-in per request (`"sync_to_lark": true`), separate from the automatic sync on real webhook traffic.

Run `npm test` before deployment. The suite covers library loading, intent ranking, internal authorization, Meta verification, signed webhooks, that a real inbound message actually produces a dashboard suggestion, that echoes of the bot's own messages never do, and the no-outbound guarantee.

## Lark Base persistence

The review store is the `Messenger AI – Thử nghiệm` table in `BÁO CÁO ĐIỀU HÀNH - GIA LINH FNG`. The destination Base/table IDs are hard-coded in `src/lark-base-sync.js` as a safety allowlist — environment variables cannot redirect writes to any other table. Each record holds a redacted message, the top draft, and `Chờ duyệt`; it never sends a Messenger reply and never touches any pre-existing Base table.
