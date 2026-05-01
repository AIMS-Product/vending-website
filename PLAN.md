# Vendingpreneurs — Webflow → Next.js/Vercel Migration

## Goal

Replace the live Webflow Vendingpreneurs marketing site with a Next.js
implementation deployed on Vercel, preserving brand, content, lead capture,
and SEO equity.

## Constraints

- Stack: Next.js 14 (App Router), TypeScript strict, Tailwind, shadcn/ui
- Vercel team: `aimanagingservices` (AIMS) — never personal scope
- GitHub org: `AIMS-Product` — never personal account
- Working directory: `/Users/jamesaims/vending-website/`

## Core Invariant

No live traffic and no lead submission is lost during or after cutover.
Existing URLs resolve (200 or 301). Form submissions continue to reach
their destination.

## Unsafe Outcomes

- _Apply Now_ submits but the lead goes nowhere (silent revenue loss)
- DNS cuts over before the new site is production-ready (visitors hit 5xx)
- Webflow URLs 404 after cutover (SEO and inbound link rot)
- Testimonial videos break or load slowly (named real people, attribution)
- Brand drift — gradient, V wordmark, pill CTAs end up "close but off"

## Risk Tiers

| Area                  | Tier                  |
| --------------------- | --------------------- |
| Visual rebuild        | 3                     |
| Lead form integration | **1** (revenue path)  |
| Domain / SEO cutover  | **1** (live business) |

## Slice Plan

### Slice 0 — Scaffold & preview deploy (Tier 3) — SHIPPED (Sentry + GA4 deferred)

- ✅ Next.js 16 (App Router), React 19, TS strict, Tailwind 4
- ✅ Repo: `AIMS-Product/vending-website` (private)
- ✅ Vercel: `aimanagingservices/vending-website`, auto-deploys from `main`,
  live at https://vending-website.vercel.app
- ✅ `src/lib/config.ts` Zod-validated env, `server-only` guard
- ✅ Required app-router files: `not-found.tsx`, `error.tsx`, `loading.tsx`,
  `global-error.tsx` (uses Next 16's `unstable_retry`, NOT the old `reset`)
- ✅ `next/font` Inter wired through `@theme inline { --font-sans }`
- ✅ Husky + lint-staged + prettier + tsc on every commit
- ✅ `@vercel/analytics` + `@vercel/speed-insights` live
- ⏸️ Sentry: deferred (Chrome MCP not reachable)
- ⏸️ GA4 measurement ID: deferred (property not yet provisioned)

### Slice 1 — Marketing shell + home page (Tier 3) — SHIPPED

Five visible sections: Hero, BrandStrip, Benefits ("Why Vendingpreneurs?"),
AcceleratorProgram, Testimonials, FinalCta ("Take Action Today"), plus
shared Header/Footer. Apply Now CTAs link to `/apply` (placeholder until
Slice 4).

**Slice 1a — component shells with placeholders (SHIPPED)**

- All five sections built with gradient placeholders for imagery
- Pill `Button` primitive with arrow chip
- 12 stub pages for nav links (later trimmed to 7 in Slice 1b)
- Typed content modules: `src/lib/content/{home,nav,testimonials}.ts`
- `.claude/rules/{components,pages}.md` scoping conventions

**Slice 1b — real assets pulled from live Webflow (SHIPPED)**

- All imagery sourced from live Webflow CDN: hero, why, accelerator, cta
  (AVIF), 8 partner logos (PNG), testimonial avatars + video posters
- V wordmark PNG (909×274) replaces the drafted SVG
- `<video>` tags for video testimonials (Bunny CDN URLs); `next/image`
  for avatar testimonials
- Q9 RESOLVED: 5 partner nav items are external links to vendhub.ai
  (stub pages for Marketplace/Leads/CPA/Financing/Insurance deleted)
- Q1 PARTIAL: live site's Apply Now goes to vendingpreneurs.com/
  booking-website. New site keeps `/apply` internal until Slice 4.

**Slice 1c — video migration (QUEUED, not urgent)**

- Migrate 4 testimonial videos from Bunny CDN to Cloudflare Stream
  (per Q4 decision)
- Update `videoUrl` in `src/lib/content/testimonials.ts` to playback URLs
- Bunny videos work fine right now — defer until convenient

**Routes currently live:**

- `/` — full home page with real assets
- `/apply` — Stub component (placeholder; Slice 4)
- `/about`, `/case-studies`, `/news`, `/contact`, `/terms`, `/privacy`
  — all use the shared Stub component (filled in Slice 2 / Slice 3)
- All five `/marketplace`, `/leads`, `/cpa-experts`, `/financing`,
  `/insurance` are now external nav items (no internal route)

### Slice 2 — Secondary static pages (Tier 3) — NEXT, narrowed scope

Pull About + Terms + Privacy real content from live Webflow site (we
already have the pull pipeline working). Use the shared component library.

Out of scope for Slice 2 (deferred):

- Case Studies → needs the custom CMS (Slice 3)
- News → needs the custom CMS (Slice 3)
- Contact → pairs with the lead form, rebuilt in Slice 4
- Marketplace/Leads/CPA/Financing/Insurance → already external (Q9)

Definition of done:

- `/about`, `/terms`, `/privacy` render real Webflow content (no Stub)
- Each page has its own `metadata` export
- Content in typed modules under `src/lib/content/` (not inlined)
- Build clean, visual screenshot vs live Webflow looks reasonable

### Slice 3 — Dynamic collections (split into 3a + 3b)

Detailed brief: `docs/slice-3-brief.md` (drafted 2026-05-01).

Key finding from inspecting the live site: only News is a real CMS
collection (~35 articles). Case Studies is a single landing page with
~13-15 testimonial cards — no detail pages. So Slice 3 splits:

- **Slice 3a — Case Studies (Tier 3, small):** ship as a typed content
  module like Slice 2, with video/written quote cards. No backend.
- **Slice 3b — News CMS (Tier 2, deliberate):** Supabase
  `news_posts` table, magic-link admin at `/admin/news`, markdown
  editor (recommended), Supabase Storage for images, `/news` index +
  `/news/[slug]` detail. ~35 article migration via manual rewrite or
  Webflow export.

Slice 3b is gated on 8 open questions (Q-NEWS-1..8 in the brief) —
editor UX, auth model, migration path, draft visibility, etc. Stop and
answer those before any 3b code.

### Slice 4 — Lead capture (Tier 1)

Apply Now + Contact → server action → Supabase `lead_submissions` table

- Resend transactional email + optional Slack webhook (per Q1 decision).

Required:

- Server-side Zod validation, never trust client
- Idempotency key per submission
- Audit row per submission (the Supabase row IS the audit row)
- Generic client errors, full server logs
- Tests: duplicate submit, malformed payload, downstream 5xx, missing audit

### Slice 5 — SEO + cutover (Tier 1)

- `sitemap.xml`, `robots.txt`, OG images
- Full 301 redirect map from every existing Webflow URL
- DNS swap in a low-traffic window with rollback plan
- Post-cutover smoke + Lighthouse pass

## Open Questions (status)

| #   | Question                                              | Status                                                               |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Where do Apply Now submissions go today (and after)?  | ✅ Supabase + Resend + Slack (new); current goes to /booking-website |
| 2   | Who owns DNS, and what is the cutover window?         | ⏳ Investigate at Slice 5 via dig/whois                              |
| 3   | Full list of existing Webflow URLs (for redirect map) | ✅ Pull sitemap.xml at Slice 5 (user OK'd)                           |
| 4   | Testimonial video hosting plan                        | ✅ Cloudflare Stream — migrate from Bunny CDN in Slice 1c            |
| 5   | Brand font                                            | ✅ Inter (Google Fonts via next/font)                                |
| 6   | CMS for News + Case Studies                           | ✅ Custom-built (Supabase + admin UI) — Slice 3, Tier 2              |
| 7   | Testimonial likeness rights                           | ✅ Carry over to new domain (user confirmed)                         |
| 8   | Analytics                                             | ✅ GA4 + Vercel Analytics; GA4 measurement ID still pending          |
| 9   | Partner pages — real content or off-site?             | ✅ External links to vendhub.ai (resolved during 1b asset pull)      |
| 10  | Sentry — net new project or existing?                 | ✅ Net-new under AIMS Sentry org — DEFERRED on Chrome MCP            |

## Decisions Log

- **2026-05-01** — GitHub repo: `AIMS-Product/vending-website` (private).
- **2026-05-01** — Vercel project: `aimanagingservices/vending-website`,
  auto-deploys from `main`. Live preview at
  https://vending-website.vercel.app. No custom domain — Webflow remains
  authoritative until Slice 5 cutover.
- **2026-05-01** — Q1: lead capture → new Supabase `lead_submissions` table
  - Resend email + optional Slack webhook. (Slice 4)
- **2026-05-01** — Q2: DNS owner unknown — investigate at Slice 5 via
  `dig`/`whois` against the live domain.
- **2026-05-01** — Q3: pull `https://vendingpreneurs.com/sitemap.xml` for
  the Slice 5 redirect map. (User confirmed yes.)
- **2026-05-01** — Q4: Cloudflare Stream for testimonial video hosting.
- **2026-05-01** — Q5: Inter via `next/font` as the brand font.
- **2026-05-01** — Q6: custom-built CMS for News + Case Studies (Supabase
  - admin UI). Slice 3 scope grew from Tier 3 → Tier 2.
- **2026-05-01** — Q7: testimonial likeness rights carry over to the new
  domain (user confirmed).
- **2026-05-01** — Q8: GA4 + Vercel Analytics for analytics.
- **2026-05-01** — Q9 (resolved while pulling assets): the five "partner"
  pages (Marketplace, Leads, CPA Experts, Financing, Insurance) are NOT
  internal pages on the live site — they're external links to
  https://www.vendhub.ai/. Mirrored that in `nav.ts` (`external: true`)
  and removed the corresponding stub pages.
- **2026-05-01** — Q1 partial: the live site's Apply Now and Contact buttons
  go to `https://www.vendingpreneurs.com/booking-website` (a separate
  booking page). New site keeps `/apply` internal and will replace this
  with the new lead capture in Slice 4.
- **2026-05-01** — Q10: net-new Sentry project `vending-website` under
  AIMS Sentry org. **DEFERRED** — Chrome MCP not connected at setup time;
  wire once the extension is reachable, or via `/sentry-setup` skill.
- **2026-05-01** — GA4 measurement ID not yet provisioned; code wiring
  deferred until the property is created. `@vercel/analytics` is live now.
- **2026-05-01** — Slice 1 starting. Asset dependencies: V wordmark,
  partner logos, hero/section imagery — using drafted SVGs and
  placeholders; will swap to live assets in a Slice 1b pass once we have
  source files (or pulled from the live Webflow site).
- **2026-05-01** — Slice 1a shipped to https://vending-website.vercel.app.
  All 5 sections render server-side (verified via curl + visual screenshot).
  16 routes statically generated. Slice 1b queued: pull live Webflow
  imagery, partner SVG logos, headshots; upload testimonial videos to
  Cloudflare Stream and wire `videoId` in
  `src/lib/content/testimonials.ts`.
- **2026-05-01** — Slice 1b shipped. Live Webflow assets pulled and wired
  through next/image; partner nav externalized; visual screenshot of new
  preview matches the original near-pixel-perfect on the hero. Bunny CDN
  videos still in use (Cloudflare Stream migration → Slice 1c).
- **2026-05-01** — Slice 2 scope narrowed: only About + Terms + Privacy.
  Case Studies and News deferred to Slice 3 (custom CMS). Contact
  deferred to Slice 4 (lead form rebuild).
- **2026-05-01** — Slice 2 shipped. /about, /terms, /privacy render
  real Webflow content via typed content modules and a shared
  `LegalDocument` section that drives both Terms (21 sections) and
  Privacy (18 sections). Per-page metadata exports. Stub component
  dropped from these three routes. Commit `88005be`.
- **2026-05-01** — Slice 3 split into 3a (Case Studies static, Tier 3)
  and 3b (News CMS, Tier 2) after inspecting the live site —
  `/case-studies` is a single landing page with ~13-15 testimonial
  cards, not a CMS collection. See `docs/slice-3-brief.md`.
- **2026-05-01** — Slice 3b decisions locked (Q-NEWS-1..8 in brief):
  - Q-NEWS-1: Markdown editor (with live preview) — simple, durable.
  - Q-NEWS-2: Owner-only auth via Supabase magic link, gated by an
    `app_users` table.
  - Q-NEWS-3: Manual rewrite migration of the ~35 articles (~3 hrs).
  - Q-NEWS-4: Drafts admin-only — no public preview URL.
  - Q-NEWS-5: No comments / share counts / engagement features.
  - Q-NEWS-6: Single author (Mike) — `author` field is free text on
    the post for now, no authors table.
  - Q-NEWS-7: Flat list — no tags / categories.
  - Q-NEWS-8: No in-site search — Google handles it post-cutover.
- **2026-05-01** — Slice 3a Q-CS-1 locked: ship all ~13-15
  testimonials currently on the live site; prune later if the page
  feels long.
