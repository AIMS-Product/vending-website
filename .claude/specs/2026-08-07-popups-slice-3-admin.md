# Slice 3 — /admin/popups CRUD + live preview + stat tiles

Continuation of `.claude/specs/2026-08-07-popups-prompt.md` (read it first).
Slices 1+2 are LIVE on main as of 2026-08-07 (`fdeed08`, `23e1951`): typed
`POPUPS` array in `src/lib/content/popups.ts`, `SitePopup.tsx` renderer with
exported `PopupCard`, events riding `/api/attribution/events`. Both seed
popups are `active: false`.

## Goal

`/admin/popups` like LeaseStack's popup admin (Adam approved that screenshot as
the target): list → editor with **live preview on the right**, template picker
on create, draft/active/paused status, four stat tiles (shown / CTA clicks /
converted / dismissed). No embed-snippet section — this site renders its own
popups.

## Hard requirements

1. **Preview renders the exported `PopupCard` component.** Never a second
   rendering codepath. This was the whole point of exporting it.
2. Follow `docs/design/admin-studio.md` (execution contract, not inspiration)
   and copy the established patterns in `AdminLeadsManager` /
   `QualificationFormsManager`. `requireAdmin` first in every server action.
3. Templates = data. Seed the template picker from objects reusing the `Popup`
   shape (the two existing `POPUPS` entries become templates "Exit intent" and
   "Scroll offer").
4. Popups move from the code array to a Supabase `popups` table (columns
   mirror the `Popup` type; RLS on, admin-only like sibling admin tables).
   `SitePopup` needs a load path: server-fetch in the root layout and pass as
   prop to `<SitePopup popups={...} />` (keep the static `POPUPS` array as
   fallback/templates). Renderer helpers (`pickPopup` etc.) already accept a
   popups argument — don't fork them.
5. Light theme, no emojis, Lucide-style inline SVGs (lucide-react is NOT
   installed; no new deps without asking).

## Stat tiles — the open design decision

Popup events are **forwarded, not stored**: the route relays to
`MONEY_PAGE_INGEST_URL` = `https://money-page.vercel.app/api/ingest/<uuid>`
(project `jypdaimhhmzfsgssomhj`, visible in Adam's Supabase account; repo not
on this machine). Tiles need a queryable source. Decide with Adam:

- (a) read counts from money-page (check if it exposes a query API), or
- (b) narrow `popup_events` table here, written by the attribution route
  alongside the forward (spec's original fallback). If (b): same
  rate-limit + first-party checks the route already does — they're live now.

## Database access — proven path (2026-08-07)

- **NEVER `supabase db push`** — remote migration history is drifted; a push
  re-runs applied migrations, seed inserts included.
- Apply single migration files via Management API:
  `POST https://api.supabase.com/v1/projects/aacisvhkmsaabqdvdmmf/database/query`
  with `{"query": "<sql>"}`, Bearer PAT. Verified working; pre-flight with
  `to_regclass` checks, verify RLS/indexes after. Adam's PAT from 2026-08-07
  was pasted in chat and should be treated as rotated — ask for a fresh one.
- The adamwolfe102 Supabase dashboard login can NOT see this project; it lives
  in the account holding vendhub/SteelTrap/money-page.
- `.env.local` anon key 401s and service key is a placeholder. Prod keys:
  `vercel env pull` (delete the file after; values marked sensitive pull
  empty — see memory `vercel-env-pull-sensitive-empty`).
- `public_request_hits` (rate limiting) is applied and live as of 2026-08-07.

## Traps carried over

- A popup that captures email joins the Close pipeline: `CLOSE_RESOURCE_TAGS`
  is an explicit map — a new popup magnet needs its own entry or it lands with
  no Resource Tag. Newsletter-consent signups enqueue to an ActiveCampaign
  queue that may still be undrained. **Do not touch `src/lib/close/*`.**
- Concurrent sessions share this checkout — verify `git status` before work.
- rtk grep can silently report 0 matches on parenthesized patterns; verify
  with `git diff`/python before concluding code is absent.

## Ship gate

`npm run typecheck && npm run lint && npm run test` with real output; UI
change → design-qa/browser check on `/admin/popups`; then `/cap` (pushes to
main deploy production — popups stay inactive until Adam flips them).
