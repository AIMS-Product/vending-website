# Vendingpreneurs — GO-LIVE HANDOFF (2026-07-27)

> **HISTORICAL.** The cutover described here happened on 2026-07-27 and this
> document is kept only as the record of it. For current state see
> `.claude/specs/2026-07-27-post-cutover-handoff.md` and
> `.claude/specs/2026-07-28-analytics-and-tracking-handoff.md`.

Purpose: everything needed to flip vendingpreneurs.com from the old Webflow site
to this Next.js app, point traffic at the new pages, and confirm leads flow into
Close. Written to be handed to a fresh session or a second engineer.

Repo: `/Users/adamwolfe/vending-website` · Vercel: `aimanagingservices/vending-website`
Release branch: `feat/conversion-embeds` (HEAD `a892ec9`) — must merge to `main`.

---

## 0. Plain-English summary (read first)

- The new site is fully built and tested on staging. Leads capture, get scored,
  route to the right Calendly, and sync to Close CRM with all fields.
- We are NOT live yet: the custom domain still points at the old Webflow site,
  and production deploys are intentionally frozen.
- Going live = 3 moves, in order: (1) merge the branch to main, (2) lift the
  Vercel production freeze + deploy, (3) point DNS at Vercel.
- One real decision is still open: **nobody gets an email/Slack alert when a new
  lead comes in** (leads are still safely saved + visible in `/admin/leads`).
  Decide if that's acceptable for launch or wire a channel first.
- One external dependency: **Stephen must create the UTM fields in Close** if we
  want UTM tags to appear in Close. Leads sync fine without it; only the UTM
  columns are affected.

---

## 1. What ships at cutover

The whole `feat/conversion-embeds` branch (40+ commits) merges to `main`. Highlights:

- `/contact` — the streamlined single-page apply funnel (name/email/phone + guide
  opt-in + SMS consent + timeline + invest dropdowns, inline fit result, no page
  hops). Score → Calendly routing baked in.
- `/booking-youtube` and `/booking-meta` — 1:1 clones of `/contact` for paid
  traffic, tagged with their own `source_path` (noindex, canonical → /contact).
- Lead scoring engine + score-based Calendly routing (band calendars hardcoded).
- Close CRM sync (async queue drained by cron) — includes the 2026-07-27 fix
  `a892ec9` that writes contact-scoped fields to the contact (without it the 4
  qualification fields land blank in Close).
- 13 old Typeform conversion pages replaced with native forms + Calendly handoff.
- Legacy inbound URLs handled by `[legacyLeadPath]` catch-all + `legacy-routes.ts`.
- Admin: `/admin/leads` backstop, funnel/source/booking analytics, Calendly
  booking capture via signed webhook, news CMS (32 drafts, unpublished).

Confirm the fix is in the release: `git branch --contains a892ec9` → `feat/conversion-embeds`.

---

## 2. Production env — CURRENT STATE (verified 2026-07-27)

PRESENT in Vercel production (good):

- `CLOSE_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (= https://www.vendingpreneurs.com), `NEXT_PUBLIC_DEFAULT_CALENDLY_URL`
- `OPENAI_API_KEY`
- **4 Close field IDs (added 2026-07-27):** `CLOSE_PURCHASE_TIMELINE_FIELD_ID`,
  `CLOSE_AVAILABLE_CAPITAL_FIELD_ID`, `CLOSE_CONSENT_STATUS_FIELD_ID`,
  `CLOSE_CONTACT_PREFERENCE_FIELD_ID`

RESOLVED 2026-07-27:

- **Lead notifications — WIRED (Slack).** `SLACK_WEBHOOK_URL` is set on prod +
  preview → the #vp-site-leads Slack channel. Code fix `22ef5a8` makes Slack a
  standalone channel (email no longer required). Test post to the channel
  returned HTTP 200. Every new lead will alert #vp-site-leads at go-live.

MISSING from production — decide/act before or at cutover:

- **`CALENDLY_WEBHOOK_SIGNING_KEY` (P1):** present on preview, absent on prod.
  Without it, booked calls won't be captured into the admin analytics dashboard
  (leads/bookings still happen; only the reporting is affected). Copy the same
  value used on preview into production.
- **UTM Close field IDs (external, P1):** `CLOSE_UTM_SOURCE_FIELD_ID` etc. are
  unset because the fields don't exist in Close yet. Our site captures + queues
  all UTMs; they only appear IN Close once Stephen creates the fields and sends
  IDs. See §7.
- **Band Calendly overrides (optional):** `NEXT_PUBLIC_SETTER_CALENDLY_URL`,
  `NEXT_PUBLIC_LANE_1_CALENDLY_URL`, `NEXT_PUBLIC_LANE_1_TOP_CALENDLY_URL`,
  `NEXT_PUBLIC_ROADMAP_URL`. Not required — code has correct hardcoded defaults.
  Set only if the booking links should differ from the defaults in
  `src/lib/qualification/thank-you-links.ts`.

Note: Vercel env vars apply to deployments created AFTER they're set. All the
above must be in place before the cutover production deploy (a redeploy of an
old build will NOT pick them up).

---

## 3. The production freeze (must be lifted to go live)

Currently blocking ALL production deploys (per `AGENTS.md`):

1. `vercel.json` → `git.deploymentEnabled.main = false`
2. `vercel.json` → production `ignoreCommand` (exits 0 = skip build on prod)
3. Vercel project-level "Ignored Build Step" (dashboard)
4. Vercel `autoAssignCustomDomains = false`

At cutover, lift these deliberately (do NOT lift before you're ready to launch).
Minimum to deploy prod: remove/flip #1 and #2 in `vercel.json` (commit), and
clear the project-level Ignored Build Step (#3) in the Vercel dashboard.

---

## 4. Cutover sequence (do in this order)

### Step A — Pre-flight verification (before touching anything)

```bash
cd /Users/adamwolfe/vending-website
git checkout feat/conversion-embeds && git pull
npm run typecheck && npm test && npm run lint && npm run build
npm run check:launch -- http://localhost:3015        # expect checked=10 failures=0
npm run check:launch:prereqs -- --skip-deployment-check
```

Resolve any hard failures (notifications decision, any missing env) before proceeding.

### Step B — Merge to main

- Merge `feat/conversion-embeds` → `main` (PR or fast-forward). Confirm `a892ec9`
  is included.

### Step C — Lift the freeze + deploy production

- Edit `vercel.json`: set `git.deploymentEnabled.main = true`, remove the
  production `ignoreCommand`. Commit to main.
- In Vercel dashboard: clear the project-level Ignored Build Step.
- Let the production deploy build. Wait for `Ready`:
  `vercel ls vending-website --prod`
- Verify the protected prod deployment BEFORE DNS:
  ```bash
  npm run check:launch -- --deployment https://<deployment>.vercel.app
  npm run check:launch:prereqs -- --deployment https://<deployment>.vercel.app
  ```
  Expect: launch checks pass, env failures gone, only DNS warning remains.

### Step D — Production smoke (safe test records only)

1. Submit `/contact` on the prod deployment URL.
2. See the row in `/admin/leads`.
3. Wait ≤10 min (or hit the cron route) → confirm the lead appears in Close with
   the 4 fields on the CONTACT (not the lead).
4. If notifications wired: confirm the alert arrives.
5. Confirm admin magic-link login works for the real inbox.
6. Delete the test lead from Close + `/admin/leads` afterward.

### Step E — DNS cutover

Point the domain at Vercel (source of truth = `vercel domains inspect vendingpreneurs.com`):

| Purpose | Type | Host                        | Value         |
| ------- | ---- | --------------------------- | ------------- |
| Apex    | A    | `@` / `vendingpreneurs.com` | `76.76.21.21` |
| WWW     | A    | `www`                       | `76.76.21.21` |

- Requires DNS registrar access for `vendingpreneurs.com` (currently GoDaddy —
  nameservers `ns59/60.domaincontrol.com`, apex `198.202.211.1`, `www`→`cdn.webflow.com`).
- In Vercel: set `autoAssignCustomDomains` appropriately and add/verify the
  domain on the project.
- After DNS change:
  ```bash
  dig +short A vendingpreneurs.com
  dig +short A www.vendingpreneurs.com
  curl -I https://vendingpreneurs.com
  curl -I https://www.vendingpreneurs.com
  npm run check:launch:prereqs -- --require-domain-configured
  ```

---

## 5. What happens automatically once live

Vercel crons run ONLY on production, so at cutover these start firing:

- `/api/admin/close-sync/run` every 10 min → drains the Close queue → leads +
  qualification fields push to Close automatically. (This is why nothing needs a
  manual trigger once live; on staging it never ran, which is why we tested manually.)
- `/api/admin/qualification-lifecycle/run` every 10 min → lifecycle/stale follow-ups.
- `/api/admin/scheduled-publishing/run` every 5 min → scheduled content.

Any leads currently queued on staging are a separate DB; they will not carry
over. Real production leads start clean at cutover.

---

## 6. First-hour watch

- Vercel deploy logs for 4xx/5xx spikes.
- `/admin/leads` for test + real submissions.
- Notification destination (if wired).
- Close sync outcomes: watch for `failed` / `dead_letter` / `needs_review`
  events (admin or DB `close_sync_events`).
- Sentry for new server/client errors.
- Re-run `npm run check:launch:prereqs -- --require-domain-configured` after DNS propagates.

---

## 7. External dependency — Stephen / Close fields

- The 4 answer/consent fields already exist in Close and are CONTACT-scoped
  (correct). Verified working end-to-end 2026-07-27.
- For UTM tracking to appear in Close, Stephen must create UTM custom fields
  (utm*source/medium/campaign/term/content) and send the field IDs, then add
  `CLOSE_UTM*\*\_FIELD_ID` to prod env. Recommend he makes UTM + score/band fields
  **LEAD-scoped** (that's where the code routes them); keep answer/consent fields
  CONTACT-scoped.
- Without this, leads still sync fully; only the UTM columns stay blank in Close.

---

## 8. Rollback

- Fails BEFORE DNS cutover: keep DNS as-is; roll back to the previous Ready
  Vercel deployment. No public impact.
- Fails AFTER DNS cutover: revert the web DNS records to the old provider values
  (apex `A 198.202.211.1`, `www` CNAME `cdn.webflow.com`), verify with `dig` +
  `curl`. Form submissions remain recoverable in Supabase `/admin/leads`.

---

## 9. Key reference

- Launch runbook (older, still valid steps): `docs/cutover/launch-day-runbook.md`
- Blockers log: `docs/launch-blockers.md`
- Route strategy: `docs/cutover/`
- Legacy URL registry: `src/lib/content/legacy-routes.ts`
- Calendly band links (hardcoded defaults): `src/lib/qualification/thank-you-links.ts`
- Close sync + the scope fix: `src/lib/close/sync.ts`, `src/lib/close/client.ts`
- Verify scripts: `npm run check:launch`, `npm run check:launch:prereqs`
- The 2026-07-27 Close scope fix commit: `a892ec9`

## 10. Go / No-Go checklist

- [x] Lead notifications wired — Slack #vp-site-leads (`SLACK_WEBHOOK_URL` on prod+preview, fix `22ef5a8`)
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY` copied to prod (or accept no booking analytics)
- [ ] `feat/conversion-embeds` merged to `main`, fix `a892ec9` included
- [ ] Local + protected-prod-deployment `check:launch` pass
- [ ] Freeze lifted (`vercel.json` #1/#2 + dashboard Ignored Build Step)
- [ ] Production deploy `Ready` and verified pre-DNS
- [ ] Production smoke: lead → `/admin/leads` → Close (4 fields on contact) OK
- [ ] DNS pointed at `76.76.21.21`, HTTPS + domain configured confirmed
- [ ] First-hour watch active
- [ ] (Post-launch) Stephen's UTM fields + `CLOSE_UTM_*_FIELD_ID` env
