# UI cohesion — slice plan (approved 2026-09-22)

Report: https://claude.ai/artifact/E217wNs8tdb5LnTZVKmj6J (44 findings, full slice detail, evidence).
Branch: `feat/ui-cohesion` in worktree `~/vending-website-ui-cohesion` (from main 75f71f4).
Capture tooling (tracker-blocked, read-only): scratchpad `ui-audit/{capture,vp}.mjs`. Before/after at 1440/768/390, same scroll offsets.
Each slice: typecheck, lint, tests, build, then `/cap` with only that slice's files. Push to main = production.

## Status

- [ ] 00 High-schools page content (page builder, Adam/Kody; no code)
- [x] 01 Foundations: tokens + ui/Section, Container, Card, Field, Highlight; Button `size`; DESIGN.md public system — branch feat/ui-01-foundations
  - Pixel-identical on /, /contact, /about at 1440/768/390 (PNG byte compare). Only visual change: legacy-form selects 50px -> 52px.
- [x] 02 Chat teaser off on legacy booking pages (in suppressesChatTeaser, merged with main #39); launcher lifts above sticky CTA — b551bb3
- [x] 03 Sticky CTA hidden while #apply-form is on screen — eedc835
  - PR #40 squash-merged fa7d2d5 (2026-09-23 00:02Z), verified live on www.
- [x] 04 VSL poster/overlay collision (ApplyVsl.tsx + asset)
- [x] 05 Reviews as HTML cards (ApplyTestimonials.tsx, apply-page.ts) — feat/ui-05-review-cards (stacked on 01)
- [x] 06 Member story posters (ApplyMembers.tsx)
- [x] 07 t5/ak-t5 short form layout (BookingForm, PublicLeadForm simpleContact)
- [x] 08 Branded thank-you shell
- [ ] 09a/9b Legacy lead template onto funnel system; nav off — 09a done, 9b open (form-length decision)
- [x] 10 Lead-magnet pages
- [x] 11 404: proxy raw HTML + soft-404 (HTTP 200)
- [x] 12 Home: highlight overlap, video cards, review wall, sticky column
- [x] 13 ContentPage template (phone tabs, 2-col steps)
- [ ] 14 Case studies · 15 News article · 16 Newsletter · 17 Pre-call one autoplay · 18 About/Solutions/tablet
- [ ] 19 Headline system (decision: Anton site-wide?) · 20 Button/card sweep
- [ ] 21 Admin screenshot pass (needs Adam sign-in) · 22 admin loading.tsx · 23 token cleanup · 24 auth card

### PRs (2026-09-23, all open, none merged)

Merge #43 first. #47, #51, #55 and #52 are based on `feat/ui-01-foundations`; the rest are cut from main.

- 01 #43 · 04 #45 · 05 #47 · 06 #49 · 07 #50 · 08 #51 · 09a #52 · 10 #53 · 11 #54 · 12 #55 · 13 #56

## Open decisions

- Anton as site-wide headline face (slice 19).
- One income-claim format (Kody) — flagged, never reworded by us.
- Legacy 8-field form vs /contact 4-field form (slice 9b).

## Invariants

- No changes to lead capture field names, attribution, Close sync, consent copy.
- `isFunnelChromePath` drives header/footer AND teaser; slice 02 must not change chrome on legacy pages (that is 9a).

## Gotchas learned

- Tracker block regex must be host-only (`/posthog\.com/`): dev chunk names contain "posthog", blocking them kills hydration and fakes results.
- Stop `next dev` before `npm run build` (guard-next-build refuses otherwise), and `rm -rf .next` before restarting dev: a dev server started after a build can serve the build's stale CSS (new theme utilities silently missing).
- tailwind-merge drops a `leading-*` that comes before a `text-[size]` class in the same cn() call; put the size first.
- Worktree needs a real `npm ci`; Turbopack rejects a symlinked node_modules.
- In `next dev`, scrollTo right after load can land before hydration; use mouse.wheel + 1.5s waits.
