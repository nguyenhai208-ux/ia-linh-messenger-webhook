# messenger-ai-service

Messenger suggestion layer for Gia Linh FNG sales: real inbound messages get classified, matched against the 138-script library, and shown on a staff dashboard behind Facebook Login. Full behavior spec is in `README.md` and `docs/Messenger-AI-Base-Workflow-V0.md`.

## Non-negotiable invariants

- No code path may send a message to Messenger. There is intentionally no send endpoint anywhere — not on the webhook path, not on the dashboard (the "Gửi qua Meta" button in `dashboardPage()` is permanently `disabled`).
- `/suggestions` always returns `outbound_sending: false` and `requires_human_approval: true`.
- Safety classification (`src/inquiry-safety.js`) judges only message text — never sender identity, name, avatar, or account age.
- Lark sync on real webhook traffic is gated by a single switch, `LARK_BASE_SYNC_ENABLED=true` — it is automatic (no per-message opt-in) because the "request" is the real customer message itself. The manual `/suggestions` endpoint is different: sync there is opt-in twice over (`LARK_BASE_SYNC_ENABLED=true` AND `sync_to_lark: true` in the body), since that endpoint can be called for testing/scripting, not just real traffic.
- The dashboard's in-memory `recentSuggestions` list is a UI convenience, capped at 100, and is wiped on every restart/deploy. It is NOT the audit trail — Lark Base is. Never treat the two as equivalent, and never remove the Lark sync path on the assumption the in-memory list is "good enough."

## Hard-coded allowlist — verify before touching

`src/lark-base-sync.js` hard-codes the destination Base (`MOqwbuHCaa00cAskjDRljqYUggd`, "BÁO CÁO ĐIỀU HÀNH - GIA LINH FNG") and table (`tbl3FxaqNVXUXhcN`, "Messenger AI – Thử nghiệm"). This is deliberate: env vars must never be able to redirect writes to a legacy table.

**2026-08-29 incident:** this table ID was previously wrong — hard-coded to `tbl6dJjA1iQvS4V0` ("Bảng", the Base's default table) instead of the real test table. The 15/15 test suite did not catch it because no test exercises the real Lark write path (only the `LARK_BASE_SYNC_ENABLED=false` branch). Fixed by comparing the ID against `GET /open-apis/bitable/v1/apps/{base}/tables` output directly, not by trusting the source comment. Before ever changing `appToken`/`tableId`, re-verify against a live table list — don't assume the existing constant is correct just because it looks intentional.

## Running

```
npm install
npm test
npm run dev   # loads .env, listens on $PORT — local development
npm start     # no .env — reads env vars from the process/host, as Render does
```

No dependencies beyond Node 20+ built-ins — if `npm install` ever adds a real dependency, this file should note why.

## Lark write access — three separate permission layers

Getting real writes working (2026-08-29 → 2026-08-31) required all three of these, each a distinct failure mode with its own error:

1. **API scope** on the app (Developer Console → Permissions & Scopes): `bitable:app`, `bitable:app:readonly`, `base:field:read`. Missing → `99991672 Access denied` naming the missing scopes.
2. **Bot feature enabled + version published** (Developer Console → Add Features → Bot → Create Version). Without a Bot identity, the app cannot be found/added as a Base collaborator at all — it's invisible in the "Mời cộng tác viên" search.
3. **Base collaborator + Advanced Permission (Quyền nâng cao) role**. Being a Base collaborator with "Có thể chỉnh sửa" is not sufficient by itself — Lark Base's per-table Advanced Permission can independently override to "Không có quyền truy cập" for a specific table under both custom roles (e.g. "Chung") and system roles (e.g. "Người chỉnh sửa", which is what new collaborators auto-join). Check **both** places per table. Missing this layer → `91403 Forbidden` (no scope hint) even with scope + collaborator access in place; the code-level error becomes `1254302 The role has no permissions` once scope is fixed but Advanced Permission still blocks.

All three are now satisfied for `tbl3FxaqNVXUXhcN`. If write access ever regresses, check in this order: scope → Bot/collaborator existence → Advanced Permission role table list (both "Chung" and "Người chỉnh sửa").

## Deployment

There is already a production deployment and a registered Meta webhook — do not create new ones without checking these first:

- **GitHub**: `nguyenhai208-ux/ia-linh-messenger-webhook` (private — note the repo name is missing its leading "g", it is NOT `gia-linh-messenger-webhook`; the local package name/dashboard title are still "Gia Linh…", only the GitHub repo slug is misspelled). Remote `origin`, branch `main`.
- **Render**: `https://gia-linh-messenger-webhook.onrender.com` — auto-deploys from `origin/main`.
- **Meta app**: use `Chat bot` (`2473856919758911`) — it already has the `FACEBOOK_MESSAGING` use case, webhook URL, and page access token configured, and its `FACEBOOK_APP_ID` is hard-coded as the default in `server.js` for the staff-dashboard Facebook Login. The other app, `Gia Linh Messenger Staff` (`1628778688672102`), is a dead end: it was created around Facebook Login and Meta offers it no Messenger use case ("Tất cả (1)" lists only an ads use case), so it cannot host this integration.

**`data/suggestions-v10.json` must stay in git.** `.gitignore` used to ignore all of `data/`, which would have made any deploy crash at boot — `src/suggestion-engine.js` imports that file at module load. The ignore rule is now `data/*` plus a `!data/suggestions-v10.json` negation. Never re-broaden it.

**`npm start` must never depend on a `.env` file.** `.env` is gitignored and does not exist in the deployed container; Render injects env vars through its own dashboard. `node --env-file=.env` exits immediately (code 9, "not found") if the file is missing. `start` runs plain `node server.js`; `.env` is only loaded locally via `npm run dev`.

## History: two independent codebases were merged here (2026-09-01)

Before this merge, `origin/main` (and the live Render deploy) ran a **completely different, unrelated commit history** (`crm.js` + hand-written keyword rules + an in-memory-only suggestion list + a staff dashboard with Facebook Login), while local work had built a separate line (the 138-script engine, the two-tier safety classifier, and real tested Lark Base persistence) with a stub webhook handler that didn't even call the suggestion engine. `git merge-base` between the two returned nothing — no shared history at all.

The merge kept the **live-tested dashboard/auth shell** (Facebook Login, session cookies, `/assistant` HTML+polling) and **replaced its suggestion internals**: `crm.js`'s ad-hoc rules were dropped; `recordIncomingEvent()` in `server.js` now calls `suggest()` (138-script engine) + `assessInquirySafety()` (two-tier classifier) and additionally writes to Lark Base when `LARK_BASE_SYNC_ENABLED=true`. `crm.js` no longer exists in the working tree — do not resurrect it or its rule lists; they diverge from the PRD's requirement to use only the approved script library.

If a future change needs "what the dashboard used to look like" or "what the old rule engine said for X", it's recoverable from `origin/main`'s pre-merge history (`git log --all`), not from any file still in the tree.

## Known gaps

- **Render's env vars have not been reconciled with this merge yet.** Before redeploying: `APP_SECRET` must be the real 32-hex-char secret of Meta app `2473856919758911` (a placeholder was in local `.env` for testing); `VERIFY_TOKEN` must match Meta's "Xác minh mã" exactly; `STAFF_FACEBOOK_IDS` should be set to the real staff Facebook IDs before real staff use `/assistant` — while empty, **any** Facebook account that completes login gets in; `FACEBOOK_APP_SECRET`/`PUBLIC_BASE_URL`/`LARK_APP_ID`/`LARK_APP_SECRET`/`LARK_BASE_SYNC_ENABLED` all need to be set in Render's dashboard the same way they're set in local `.env` (Render does not read `.env.example` or `.env` — only its own dashboard-configured vars).
- No Meta webhook has yet delivered a real Fanpage message through the merged code (only local synthetic tests so far). Confirm with a real test message once Render is redeployed and env vars are reconciled.
