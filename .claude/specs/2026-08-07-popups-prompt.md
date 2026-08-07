# Prompt: per-page popup system for vendingpreneurs.com

Paste everything below the line into Claude in `/Users/adamwolfe/vending-website`.

---

Build a per-page popup/modal system for this site. Read `AGENTS.md`,
`.claude/rules/pages.md`, and `docs/design/admin-studio.md` first.

## Reference architecture (from LeaseStack, adapted)

LeaseStack ships popups to _external_ customer sites, so it needs a JS embed
snippet, a CORS'd public config API, and per-tenant scoping. **We do not.**
Vendingpreneurs is our own Next.js app, so drop the embed layer entirely and
keep the parts that actually earned their place:

1. **One campaign shape, three consumers.** A single typed `Popup` object is
   consumed by (a) the live renderer, (b) the admin preview, (c) the template
   seeds. Never a second rendering codepath — the preview must be the same
   component the visitor sees, or previews drift.
2. **Templates are data, not code.** A template is just a named set of default
   field values that seeds a new campaign. Adding a template = adding an object
   to an array.
3. **Every optional field is nullable and presence-gated in the renderer.**
   Eyebrow, hero image, featured value card, secondary CTA, offer code, dismiss
   link, gradient bar — each renders only when set. This is what makes one
   component cover every page's popup without variants.
4. **Trigger / targeting / frequency are three orthogonal config fields**, not
   baked into the copy:
   - `trigger`: `IMMEDIATE | TIME_ON_PAGE | SCROLL_DEPTH | IDLE_TIME | EXIT_INTENT`
     plus a numeric `triggerThreshold` (seconds or percent depending on trigger).
   - `targetUrlPatterns`: array of path substrings; empty = every page.
   - `frequency`: `session | once_per_day | always`, deduped via
     sessionStorage/localStorage keyed by popup id.
5. **Analytics = 4 events**: `SHOWN`, `CTA_CLICKED`, `CONVERTED`, `DISMISSED`.
   That's enough for a shown / clicked / converted / dismissed tile row.
6. **Escape hatches for testing.** Query params that bypass the machinery, since
   "I set it up but I never see it" is the #1 support issue:
   `?vppopup=preview` (ignore frequency cap + URL filter, force immediate),
   `?vppopup=clear` (wipe dedup keys), `?vppopup=off` (suppress entirely).
7. **Hard-code legibility on dark themes.** LeaseStack ignores the operator's
   `textColor` on the DARK theme and forces white-on-dark, so a half-finished
   color edit can't ship an unreadable popup. Do the same.
8. **Sanitize navigation targets.** CTA URLs go through an allowlist of
   `http: https: mailto: tel:` plus relative paths. Never assign raw config to
   `window.location`.

## What to build here

### Slice 1 — config + renderer (do this first, ship it)

- `src/lib/content/popups.ts` — typed `Popup` type + a `POPUPS: Popup[]` array.
  This is the customizable surface: each entry has its own eyebrow, headline,
  body, primary/secondary CTA text+href, optional featured value card, optional
  offer code, dismiss text, theme colors, trigger, frequency, and
  `targetUrlPatterns`. Per repo rule, all visible copy lives here as typed data.
- `src/components/site/SitePopup.tsx` — one `"use client"` component. Reads
  `usePathname()`, picks the first matching active popup, wires the trigger,
  renders the card. Tailwind, light theme by default (Adam's global rule: no
  dark theme, no emojis — use Lucide icons for CTA icons).
- Mount once in `src/app/layout.tsx` next to `<AttributionSessionTracker />`.
- Accessibility is not optional: `role="dialog"`, `aria-modal` on centered
  popups, focus trap, Escape to close, backdrop click to close,
  `prefers-reduced-motion` disables the entrance animation.
- Test: one `SitePopup.test.tsx` covering trigger firing, URL targeting match /
  mismatch, and frequency dedup. No new deps.

### Slice 2 — events (only after slice 1 is live)

Reuse the existing first-party attribution pipeline
(`src/app/api/attribution/events/route.ts` + `vp_sid` cookie) rather than
building a second events table. Add popup events as new `event_type` values with
the popup id in `properties`. If the schema can't take them, add a narrow
`popup_events` Supabase table with the same rate-limit + first-party check the
attribution route already uses.

### Slice 3 — admin (only if Adam asks)

`/admin/popups` CRUD backed by Supabase, following `docs/design/admin-studio.md`
and the existing `AdminLeadsManager` / `QualificationFormsManager` patterns:
list → editor with live preview on the right, template picker on create, draft /
active / paused status, and the four stat tiles. The editor must render the
_same_ `SitePopup` card component so preview and production can't diverge.

## Before you start — repo state as of 2026-08-07

Three things found while shipping the Close/ActiveCampaign work. Two of them sit
directly in this feature's path. Full detail in
`.claude/specs/2026-08-06-close-lead-tagging-handoff.md`.

1. **Public rate limiting is currently inert in production, and slice 2 depends
   on it.** Migration `20260801090000` was never applied, so
   `public.public_request_hits` does not exist. `src/lib/public-rate-limit.ts`
   is deliberately fail-open, so every check throws, logs
   `"public rate limit check failed open"`, and returns "allowed". Four public
   paths are affected, including `/api/attribution/events` — the exact endpoint
   slice 2 reuses. That route's own comment names the rate limit as the control
   bounding damage on "a write proxy into the downstream ingest that spends our
   secret." **Apply that migration and sanity-check `LIMITS` against real
   traffic before slice 2, and preferably before shipping a popup that drives
   more volume at it.** Applying it flips rate limiting from off to on in one
   step, so a too-tight limit would start rejecting real submissions.

2. **Do not run `supabase db push` on this project.** Remote migration history
   stops at `20260617090000` and reports nine migrations unapplied; most are
   physically applied and a push would re-run them, seed inserts included. A
   blanket `migration repair` is equally wrong — the drift is partial. Slice 2's
   "add a narrow `popup_events` table" walks straight into this. Verify real
   schema state first via the Management API
   (`POST https://api.supabase.com/v1/projects/<ref>/database/query`, needs a
   PAT), then apply single migration files deliberately. Note `.env.local`'s
   `SUPABASE_SERVICE_ROLE_KEY` is a placeholder and its anon key 401s.

3. **A popup that captures email joins the Close pipeline — plan the tagging.**
   `CLOSE_RESOURCE_TAGS` is an explicit map by design: an unrecognised magnet
   path sends **no** Resource Tag rather than inventing one inside the sales
   team's taxonomy. A new popup-driven lead magnet needs its own entry added, or
   it lands in Close with Entry Source but no Resource Tag. Separately, any
   newsletter-consented signup now fires a live DB trigger that enqueues an
   ActiveCampaign row, so a newsletter popup feeds a queue that is not yet
   drained. Don't touch `src/lib/close/*` to do any of this.

## Constraints

- No new dependencies.
- Do not touch `src/lib/close/*` or the qualification intake path.
- Local branch only — no push, no PR, no Vercel preview until asked (release
  train rules in `AGENTS.md`).
- Run `npm run typecheck && npm run lint && npm run test` and paste real output
  before claiming done.

Start with slice 1 only. Show me the `Popup` type and two example entries before
writing the renderer.
