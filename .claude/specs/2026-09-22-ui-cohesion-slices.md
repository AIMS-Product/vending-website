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
- [ ] 04 VSL poster/overlay collision (ApplyVsl.tsx + asset)
- [ ] 05 Reviews as HTML cards (ApplyTestimonials.tsx, apply-page.ts)
- [ ] 06 Member story posters (ApplyMembers.tsx)
- [ ] 07 t5/ak-t5 short form layout (BookingForm, PublicLeadForm simpleContact)
- [ ] 08 Branded thank-you shell
- [ ] 09a/9b Legacy lead template onto funnel system; nav off
- [ ] 10 Lead-magnet pages
- [ ] 11 404: proxy raw HTML + soft-404 (HTTP 200)
- [ ] 12 Home: highlight overlap, video cards, review wall, sticky column
- [ ] 13 ContentPage template (phone tabs, 2-col steps)
- [ ] 14 Case studies · 15 News article · 16 Newsletter · 17 Pre-call one autoplay · 18 About/Solutions/tablet
- [ ] 19 Headline system (decision: Anton site-wide?) · 20 Button/card sweep
- [ ] 21 Admin screenshot pass (needs Adam sign-in) · 22 admin loading.tsx · 23 token cleanup · 24 auth card

## Open decisions

- Anton as site-wide headline face (slice 19).
- One income-claim format (Kody) — flagged, never reworded by us.
- Legacy 8-field form vs /contact 4-field form (slice 9b).

## Invariants

- No changes to lead capture field names, attribution, Close sync, consent copy.
- `isFunnelChromePath` drives header/footer AND teaser; slice 02 must not change chrome on legacy pages (that is 9a).

## Gotchas learned

- Tracker block regex must be host-only (`/posthog\.com/`): dev chunk names contain "posthog", blocking them kills hydration and fakes results.
- Stop `next dev` before `npm run build` (guard-next-build refuses otherwise).
- Worktree needs a real `npm ci`; Turbopack rejects a symlinked node_modules.
- In `next dev`, scrollTo right after load can land before hydration; use mouse.wheel + 1.5s waits.
