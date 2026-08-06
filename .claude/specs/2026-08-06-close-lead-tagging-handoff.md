# Close lead tagging — state at 2026-08-06 handoff

## Done and live in production

Website leads write two Close fields on lead **create only**:

| Entry point              | Form ID          | Entry Source    | Resource Tag                                                     |
| ------------------------ | ---------------- | --------------- | ---------------------------------------------------------------- |
| Entrepreneur lead magnet | `2d3b9fbc-…`     | `Lead-Magnet`   | `lead-magnet-90-days` (roadmap), `lead-magnet-finance-templates` |
| Newsletter signup        | `7f5d8f76-…`     | `Lead-Magnet`   | `newsletter`                                                     |
| Apply / qualification    | `a1b2c3d4-…0001` | `Website-Apply` | `website-application`                                            |

Commits `9b1ab43`, `988d2e1`, `f6289ff`, `b7468fc` on `main`. Verified against
real leads in the production Close org, not just tests.

- `Website-Apply` was added as a new choice on the Entry Source field via the
  Close API. It did not exist before.
- **Recapture State and Ever Had Call are deliberately NOT written.** Close's
  Lane 2 reconciler owns them (Stephen, 2026-08-06). They were removed from the
  payload, config, env schema and `.env.example` so they are unreachable, and a
  config-layer test fails if the plumbing is re-added.
- Resource Tag values are an explicit map in `CLOSE_RESOURCE_TAGS`. An
  unrecognised magnet path sends **no** tag rather than inventing one inside the
  sales team's taxonomy.

`/admin/attribution` is a read-only diagnostics page that probes the live Close
account and reports, per field: configured in this environment, field ID exists,
correct lead/contact scope, and whether the value we send is an accepted choice.
A drift-guard test keeps it in sync with the Close config.

## Open

1. **Fill-if-empty for returning contacts.** We only tag on lead create, so
   someone already in Close who converts on a magnet gets no Entry Source. Kody
   wants the attribution added "without overwriting the original source" — fill
   only when blank. Needs a `getLead` on the Close client (only `getContact`
   exists) plus one extra API call per sync. Was waiting on Stephen; his reply
   did not address it. Tier 1 — use `safe-feature-slice`.
2. **~4 leads created 19:51–20:49 on 2026-08-06** carry `Hot-Inbound` / `No`
   that we wrote before the fix. Harmless if the Lane 2 reconciler overwrites
   them; needs clearing if it skips leads that already have values. Ask Stephen.
3. **ActiveCampaign sync** — rebased onto `main` 2026-08-06 as commit `712b3a1`
   on `codex/activecampaign-sync` in worktree
   `/Users/adamwolfe/vending-website-activecampaign`. See
   `.claude/specs/2026-08-04-close-activecampaign-newsletter-sync.md`.
   - The feared `.env.example` / `src/lib/config.ts` conflict did not happen:
     both sides were purely additive in non-adjacent hunks. Clean rebase.
   - Green on the rebased branch: `tsc --noEmit` clean, `vitest run` 1396/1396,
     `npm run lint` 0 errors (4 pre-existing warnings, none in these files).
   - All four `ACTIVECAMPAIGN_*` vars are set in **Vercel Preview only**
     (Adam's call, 2026-08-06). Account is `modern-amenities.api-us1.com`.
     The token was pasted into a session transcript — **rotate after the proof.**
   - Live account discovery corrected the spec: `Newsletter-New` (50) is a
     **tag**, not a list. There is no list 50 — the account's highest list ID is 20. Correct values are list `3` (Master Contact List) + tag `50`.
   - **The AC account is shared production marketing**, not a sandbox: Lane 2,
     the Deep Nurture tranches, VendHub Q&A, Reactivation all live there.
     "Preview only" isolates our code, not the destination.
   - 5 active automations; AC's v3 API does not expose entry triggers, so it is
     **unverified** whether subscribing to list 3 or applying tag 50 starts a
     real nurture sequence. Prove with an address Adam owns.
   - Open taxonomy question: `Newsletter-Existing` (51) also exists, but the
     sync applies `Newsletter-New` to everyone, including returning contacts.
     Kody/Stephen call, same shape as the Close resource-tag decision.
   - Nothing is deployed; the queue is inert (see migration state below).

## Supabase migration state — READ BEFORE ANY `db push`

Discovered 2026-08-06 while trying to apply the ActiveCampaign migration.

- **`supabase db push` on this project is unsafe right now.** Remote
  `schema_migrations` stops at `20260617090000` and reports **nine** migrations
  as unapplied. Most are physically applied; the bookkeeping was never written.
  A push would re-run already-applied migrations, including seed inserts.
- **A blanket `migration repair --status applied` is equally wrong** — the drift
  is partial, not uniform. Verified against the live schema:
  - applied: `20260720120000` (calendly_bookings), `20260731120000` (email
    index), `20260804153000` (newsletter form seed), `20260804170000`
    (lifecycle constraints), `20260804180000` (activecampaign_sync_events)
  - **NOT applied: `20260801090000` (`public_request_hits`)** — see below
  - unverified (seed inserts): `20260722120000`, `20260727220000`,
    `20260728200000`
- The ActiveCampaign migration **was already applied out-of-band** in the prior
  session and never recorded. Table, both indexes, RLS and the
  `close_sync_events` enqueue trigger are all live in production.
- Consequence: the enqueue trigger has been firing on production since it
  landed. As of 2026-08-06 the queue holds **2 real subscribers** (one gmail,
  one hotmail, both consented, `pending`, 0 attempts). Nothing drains them
  because the runner is not deployed anywhere — the queue is inert but growing.
- The runner drains oldest-first, so **the first drain syncs a real person**,
  not a test contact. Defer those rows' `next_retry_at` before the first
  preview proof, then release them once the pipeline is proven.
- Access: use a Supabase PAT + the Management API query endpoint
  (`POST https://api.supabase.com/v1/projects/<ref>/database/query`) for
  read-only schema checks. `.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` is a
  placeholder (`local-…`) and its anon key 401s, so nothing local reaches this
  project.

## Live bug found 2026-08-06: public rate limiting is inert

`20260801090000_public_request_hits.sql` was never applied, so
`public.public_request_hits` **does not exist**. `src/lib/public-rate-limit.ts`
reads and writes that table and is deliberately fail-open — every check throws,
logs `"public rate limit check failed open"`, and returns `true`.

**Public form endpoints have had no rate limiting since that code shipped.**
The fail-open design is correct (better than 500ing a lead form) but makes the
outage silent.

Not fixed here, deliberately: applying the migration flips rate limiting from
off to on for live public forms in one step. Check `LIMITS` is sane for real
traffic first, or a too-tight limit starts rejecting genuine submissions.

## Gotchas learned here

- **`vercel env pull` returns `""` for every sensitive variable**, even one set
  and working. Never conclude a variable is unset from it — this manufactured a
  false "empty `CLOSE_LEAD_STATUS_ID`" bug report. Verify by reading it from
  something running in that environment, such as `/admin/attribution`.
- Use `vercel env add NAME env --value "<v>" --force`. Never
  `printf '%s' "$V" | vercel env add …` — with no trailing newline the CLI stores
  an empty value and still reports success.
- Env changes need a fresh deploy: `vercel redeploy <url> --scope aimanagingservices`.
- Close returns custom fields on a lead keyed by **name**, not field ID, and its
  `custom.<id>:*` list filters do not actually filter — totals from them are junk.
- `/apply` is a 301 to `/contact`; `src/app/apply/` has no page.
