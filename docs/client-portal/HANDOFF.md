# Client Journey Portal: handoff to SteelTrap

**For:** Dom and his coding agent. Read this whole file before touching code.
**From:** Adam (product owner). Frontend built 2026-10-01 by Claude.
**State:** Frontend complete, runs on demo fixtures, NO backend connected. Your job is to move it into
SteelTrap and connect real data.

---

## 1. What this is (60 seconds)

A private, personalized page per Vendingpreneurs prospect who books a sales call. It walks them through
a dated, day-by-day plan from booking → call → follow-up → onboarding, with a live map of real places
near them, a case study of someone like them, Mike's answer videos, live community wins, their call
summary (after the call, behind email verification), and a way to ask their rep a question.

It replaces the generic `/pre-call-resources` page and the July prototype at SteelTrap `/p/[person_id]`.

Source documents (ask Adam for copies; they are not in either repo):

- **PRD v2.0** "Client Journey Portal" (AIMS Signal session 2026-09-22). Product intent, personas, stages.
- **Architecture** `client-portal-architecture-2026-10-01.md`. Data model, access classes, phases.
  This frontend uses its vocabulary on purpose (`journey_definition`, `journey_step`,
  `portal_step_state`, `portal_question`, `portal_access_grant`, "generated-link" vs "verified" access).

Design direction from Adam (2026-10-01): **story, not bulletin board.** "Here's what's happening on these
days." A calendar keyed to the call, an interactive to-do list, a real live map, clean and focused on the
person.

## 2. Where the code is

- Repo: `AIMS-Product/vending-website` (the Vendingpreneurs marketing site, Next 16, Tailwind 4).
- Branch: `feat/client-portal`. **Never merge to `main`**: `main` deploys to www.vendingpreneurs.com.
- Preview: `https://vending-website-git-feat-client-portal-aimanagingservices.vercel.app/portal/demo`
  (Vercel login required).
- Demo links: `/portal/demo` (pre-call, 3 days out), `/portal/demo-sparse` (name only, no call time),
  `/portal/demo-post` (post-call; any 6 digits unlock the notes), `/portal/demo-won` (onboarding),
  `/portal/demo-lost` (closed-lost evergreen).

### File map (everything the portal owns)

| File                                            | Role                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/portal/types.ts`                       | **The data contract** (`PortalData`). Start here.                                                                                                                                  |
| `src/lib/portal/journey.ts`                     | Default journeys per stage (stand-in for published `journey_definition`), which steps show, system-step completion, scheduling steps onto real dates.                              |
| `src/lib/portal/personalize.ts`                 | Deterministic rules: occupation → persona → case study, testimonial, objection video; stage → wins categories.                                                                     |
| `src/lib/portal/wins.ts`                        | Reads `https://wins.vendingpreneurs.com/api/wins` (public, 1h cache), zod-validated, degrades to empty.                                                                            |
| `src/lib/portal/get-portal-data.ts`             | **Read seam.** Returns fixtures today.                                                                                                                                             |
| `src/lib/portal/fixtures.ts`                    | Demo data. Delete when real data flows (keep one internal test prospect).                                                                                                          |
| `src/lib/portal/personalize.test.ts`            | 21 tests: persona rules, scheduling, system steps, private-data gate.                                                                                                              |
| `src/app/portal/[token]/page.tsx`               | Route. Reads verification cookie, loads data + wins, renders.                                                                                                                      |
| `src/app/portal/[token]/actions.ts`             | **Write seams** (server actions): `submitIntake`, `setStepDone`, `verifyEmail`, `askQuestion`. Validate with zod; demo tokens handled locally; real tokens return "not connected". |
| `src/components/portal/PortalPage.tsx`          | Page shell: header, hero (who + when + their goal), plan, ask-your-rep.                                                                                                            |
| `src/components/portal/PortalPlan.tsx`          | Client. Calendar strip, day groups, step accordion, tick/untick, progress count, localStorage stand-in for step state.                                                             |
| `src/components/portal/StepContent.tsx`         | What opens inside each step, one case per `StepContentKind`.                                                                                                                       |
| `src/components/portal/LocalOpportunity.tsx`    | Client. Map + ranked list, hover links row to pin.                                                                                                                                 |
| `src/components/portal/LocationMap.tsx`         | Client. Leaflet + OpenStreetMap tiles, numbered pins, fit-to-bounds.                                                                                                               |
| `src/components/portal/PortalForms.tsx`         | Client. Intake, verify-email, ask-question forms (`useActionState`).                                                                                                               |
| `src/components/portal/styles.ts`, `portal.css` | Shared button class; map pin styles + muted basemap.                                                                                                                               |
| `src/lib/content/portal.ts`                     | All page copy (repo rule: copy lives in content modules). Needs Jess's review.                                                                                                     |

Small edits outside the portal: `src/proxy.ts` (allow `/portal/*` two-segment paths),
`src/lib/content/booking-funnel-routes.ts` (hide site header/footer/chat teaser on `/portal/*`),
`next.config.ts` (allow wins-feed avatar host `media1-production-mightynetworks.imgix.net`), `leaflet`
dependency.

## 3. Where the UI comes from (port these into SteelTrap)

The portal must look like vendingpreneurs.com, not like the SteelTrap dashboard (the July `/p/` page was
SteelTrap white + IBM blue; Adam wants the VP look).

**Design tokens** (all inline Tailwind arbitrary values, so they port as-is):

- Ink `#111111` (text, 2px borders) · brand blue `#1f72a5` (primary buttons) · accent `#2a8fcc` (pins,
  rings) · sky `#55b8e8` (offset shadows) · link `#066a99` · paper `#f5fbff` / `#eaf6ff` (washes).
- Cards: `rounded-[12px] border-2`; the **active** card gets `shadow-[6px_6px_0_#55b8e8]`; primary
  buttons `shadow-[4px_4px_0_#111111]`.
- Type: Inter (site loads it via `next/font/google` in `src/app/layout.tsx`), headings `font-black`,
  eyebrows `text-xs font-black tracking-[0.14em] uppercase`.
- Hero wash: dotted radial gradient on `#f5fbff` (see `PortalPage.tsx`).
- No dark mode, no emojis.

**Reused site pieces** the portal imports (copy them over, or replace with SteelTrap equivalents):

| Import                                                                             | What                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `components/site/Wordmark.tsx` + `public/brand/wordmark.png`                       | VP logo                                                                                    |
| `components/site/LegalFooter.tsx`                                                  | Terms / Privacy / Spam policy links (point at vendingpreneurs.com URLs)                    |
| `components/media/VidalyticsPlayer.tsx`                                            | Mike's answer videos (Vidalytics account `erwZUUrS`; CSP must allow `fast.vidalytics.com`) |
| `components/sections/YouTubeEmbedFrame.tsx` + `lib/page-builder/video-embeds.ts`   | Click-to-play YouTube for case-study videos                                                |
| `components/sections/apply/icons.tsx` (`CheckIcon`)                                | Inline SVG check                                                                           |
| `lib/content/pre-call-resources.ts` (`preCallResources`)                           | The six objection questions, marketing's verbatim answers, Vidalytics ids                  |
| `lib/content/case-studies.ts` (`caseStudyQuotes`) + `public/images/testimonials/*` | Written testimonials + avatars                                                             |
| `data/case-studies/*.json`                                                         | Case-study library (video id, stats, excerpt). Six are imported by `personalize.ts`.       |

### Porting gotchas (vending-website → SteelTrap dashboard)

| Here                                    | SteelTrap             | Do                                                                                                                                                        |
| --------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next 16                                 | Next 15               | Same App Router APIs used (`params` is a Promise, `cookies()` awaited, server actions). Should port unchanged.                                            |
| Tailwind 4                              | Tailwind 3.4          | Classes used are 3.4-compatible (`size-*`, `text-balance`, arbitrary values). Add `components/portal/**` to `content` globs if moved.                     |
| Inter via `next/font`                   | system font           | Load Inter in the portal route's own `layout.tsx` (the July `/p/` route already has its own layout).                                                      |
| `proxy.ts` route allowlist              | Clerk `middleware.ts` | Add the portal route to Clerk public routes (July did this for `/p/*`); hide dashboard Nav/AgentDock on it.                                               |
| CSP in `lib/content-security-policy.ts` | check SteelTrap's     | Must allow: img `tile.openstreetmap.org`, `img.youtube.com`, wins avatar hosts; frame `youtube.com`, `fast.vidalytics.com`; script `fast.vidalytics.com`. |
| `next.config.ts` image hosts            | SteelTrap config      | Add `wins.vendingpreneurs.com`, `media1-production-mightynetworks.imgix.net`, `media2-production.mightynetworks.com`.                                     |

## 4. The data contract (what SteelTrap must produce)

`PortalData` in `src/lib/portal/types.ts`. Facts only; **no copy comes from the backend** except
journey step titles (when marketing publishes journeys) and the call summary.

Minimum valid payload (renders a complete page):

```json
{
  "token": "…",
  "stage": "pre_call",
  "access": "link",
  "prospect": { "firstName": "Chris" },
  "call": null,
  "localMarket": null,
  "callSummary": null,
  "onboarding": null,
  "journey": null,
  "completedSteps": []
}
```

Field → source (PRD §10 + arch doc §5):

| Field            | Source                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage`          | Close/people status: booking → `pre_call`; summary published → `post_call`; won → `won`; lost → `lost`                                                                                |
| `access`         | Server decides: `verified` only with a valid email-verification session for this portal                                                                                               |
| `prospect.*`     | Booking + intake form. `emailHint` is the MASKED bound email (`s•••@gmail.com`), never the full address                                                                               |
| `call.*`         | Booking tool (Calendly): time, rep name/title/photo, confirm/reschedule/join URLs                                                                                                     |
| `joinedAt`       | Won date (anchors the onboarding calendar)                                                                                                                                            |
| `localMarket`    | VendScout ranked locations (lat/lng required for pins) + cached research brief. July's `lib/portal/market-brief.ts` + `geocode.ts` already produce a cited brief + center; reuse them |
| `callSummary`    | Avoma → Claude prospect-safe rewrite. **Only include when `access === "verified"`**                                                                                                   |
| `onboarding`     | Skool invite, VendHub walkthrough, location search, coaching calendar URLs                                                                                                            |
| `journey`        | `null` = use `DEFAULT_JOURNEYS[stage]`. Later: the published `journey_definition` for this portal's version                                                                           |
| `completedSteps` | `portal_step_state` keys for prospect-completed steps                                                                                                                                 |

### Seams to connect (nothing else needs backend work)

1. **Read:** `getPortalData(token, { verified })`. Resolve token via a **hashed** `portal_access_grant`
   (never the raw token as a primary key, never logged). Return `null` for unknown/revoked. Omit
   `callSummary` (and any private field) unless verified.
2. **`setStepDone`:** upsert `portal_step_state` (subject-scoped, idempotent). Then remove the
   localStorage stand-in in `PortalPlan.tsx` (or keep it as an optimistic cache).
3. **`verifyEmail`:** send a one-time code to the bound email (add a "send code" action; the form
   currently assumes the code was sent), verify it, set a signed, httpOnly, path-scoped session. Replace
   the demo cookie check in `page.tsx`.
4. **`submitIntake`:** persist occupation/ZIP/goal, trigger VendScout + brief generation offline, then
   `revalidatePath`.
5. **`askQuestion`:** create `portal_question` assigned to the current rep; show replies (needs a small
   "your questions" list on the page, not built yet).

### Mapping from the July SteelTrap prototype (`people_portal`)

| `people_portal` / `reps_portal` | `PortalData`                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `first_name`, `last_name`       | `prospect.firstName/lastName`                                                                                     |
| `job_title`                     | `prospect.occupation`                                                                                             |
| `zip`, `city`, `state`          | `prospect.zip`, `localMarket.zip/city/state`                                                                      |
| `call_status`                   | `stage` (`pre_call`/`call_booked` → `pre_call`; `call_completed`/`post_call` → `post_call`; `onboarding` → `won`) |
| `call_datetime`, `call_link`    | `call.scheduledAt`, `call.joinUrl`                                                                                |
| `rep_id` → `reps_portal`        | `call.rep` (`name`, `photo_url`); `calendar_link` → `followUpUrl`                                                 |
| `goals_public[0]`               | `prospect.goal`                                                                                                   |
| `market_analysis_json`          | `localMarket.brief` (+ `center`); locations come from VendScout                                                   |
| `next_steps`, `journey_stage`   | replaced by `journey` + `completedSteps` (arch doc: no 1–100 progress number)                                     |
| `wins`, `collateral`            | not needed: wins come live from the feed; collateral is the step content                                          |
| `loom_url`                      | not used yet (July's Loom was Mike's interview, not the rep's; Adam rejected it)                                  |

The arch doc says keep old `/p/` links working until parity; migrate rows where the bound email is
certain.

## 5. Invariants (do not break)

- **Token is a capability.** Unguessable, revocable, hashed at rest, never in logs/analytics, never
  contains email/phone. Page is `noindex`, `referrer: no-referrer`, `force-dynamic` (never cached
  across prospects).
- **Private material only after verification** (call summary, transcripts, questions/replies). The
  server omits it; the UI never hides data that was sent.
- **Never show rep-only material**: coaching notes, objection tactics, scores, raw transcripts.
- **No LLM on page view.** Briefs and summaries are generated offline and cached.
- **Real proof only.** No invented numbers, no ROI or success probabilities. Case-study stats are the
  member's own published figures; wins are verbatim from the feed.
- **System steps complete from data** (call held, email verified), never from a click.
- Light theme only, no emojis, WCAG AA (keyboard: checkboxes are real `role="checkbox"` buttons, steps
  are `aria-expanded` disclosures).

## 6. Known gaps and open decisions

- **Map tiles:** OpenStreetMap's public tile server is for light use. Before real volume, switch
  `TILE_URL` in `LocationMap.tsx` to a keyed provider (MapTiler/Stadia) or Google Maps to match
  VendScout (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` exists in VendHub).
- **Demo locations** are real OSM places sorted by distance, not a VendScout ranking. Real data must
  come from VendScout.
- **Time zone:** all dates render in US Central (`PORTAL_TIME_ZONE`). Send the prospect's zone and
  thread it through `journey.ts` + `formatCallTime`.
- **Confirm call:** fixtures have no `confirmUrl`; the button hides when null.
- **Copy and persona mapping** (`src/lib/content/portal.ts`, `PERSONAS` in `personalize.ts`) need Jess's
  sign-off. Charles Wheeler and Abby C are written testimonials only (no video).
- **Tim Barnes' $90K** is an in-month projection per its case-study review note; confirm before it
  leads a page.
- **Not built:** rep view of the same journey, question/reply thread, AI answers, reminders, journey
  authoring UI (arch doc phases 4-6).

## 7. Run and verify

```bash
cd vending-website && git checkout feat/client-portal && npm ci
npm run dev   # then open /portal/demo, /portal/demo-post (enter any 6 digits), …
npx tsc --noEmit && npx vitest run src/lib/portal
```

Gotcha: `scripts/guard-next-build.mjs` blocks `next build` while a dev server runs.
