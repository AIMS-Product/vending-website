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

### Slice 0 — Scaffold & preview deploy (Tier 3) — IN PROGRESS

- Next.js 14 App Router, TS strict, Tailwind, shadcn/ui
- Repo under `AIMS-Product`, deployed to Vercel preview URL only
- `lib/config.ts` Zod-validated env, `not-found/error/loading/global-error`
- Sentry, analytics, `next/font`, husky + lint-staged + tsc on commit
- Empty home page renders "Hello"

### Slice 1 — Marketing shell + home page (Tier 3) — Slice 1a SHIPPED

Static, deployable home page rendering the five visible sections — Hero,
Why Vendingpreneurs?, Accelerator Program, Real People/Real Results, Take
Action Today — plus shared header/footer. Apply Now CTAs link to a
placeholder `/apply` page. Copy hardcoded in a typed content module.

**Scope (allowed file list):**

- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/apply/page.tsx`
- `src/components/site/{Header,Footer,NavLink}.tsx`
- `src/components/sections/{Hero,BrandStrip,Benefits,AcceleratorProgram,Testimonials,FinalCta}.tsx`
- `src/components/ui/Button.tsx` (pill CTA with arrow)
- `src/lib/content/home.ts`, `src/lib/content/testimonials.ts` (typed)
- `public/brand/*` (V wordmark SVG, partner logos)
- `tailwind.config.ts` (brand tokens)

**Invariant protected:** Home renders the same five messages with a
working CTA path, deploys cleanly to a Vercel preview, no runtime errors.

**Integration risk:** None. Preview URL only — live domain and live form
untouched. Cutover is Slice 5; lead wiring is Slice 4.

**Definition of done:**

- Lighthouse ≥ 95 on the preview URL (perf/a11y/SEO)
- Keyboard navigation works, alt text on every image, contrast passes WCAG AA
- All header + footer nav links render (placeholder pages return a stub)
- `tsc --noEmit` clean, no `any`, no `@ts-ignore`

### Slice 2 — Secondary static pages (Tier 3)

About Us, Terms, Privacy, partner landing pages (Marketplace, Leads, CPA,
Financing, Insurance), Contact. MDX, same component library.

### Slice 3 — Dynamic collections (Tier 2 — scope grew)

Custom-built CMS for Case Studies + News (per Q6 decision). Implies:
Supabase tables, admin auth, content authoring UI, image upload pipeline,
draft/publish workflow. This pushes Slice 3 from Tier 3 → Tier 2.

To plan in detail before starting: schema, auth model (single editor or
multi-user?), publish workflow, preview URLs, image hosting.

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

## Open Questions (block specific slices)

| #   | Question                                                                                | Blocks  |
| --- | --------------------------------------------------------------------------------------- | ------- |
| 1   | Where do Apply Now submissions go today (and after)?                                    | Slice 4 |
| 2   | Who owns DNS, and what is the cutover window?                                           | Slice 5 |
| 3   | Full list of existing Webflow URLs (for redirect map)                                   | Slice 5 |
| 4   | Testimonial video hosting plan — Webflow CDN, Mux, Cloudflare Stream, YouTube unlisted? | Slice 1 |
| 5   | Brand font name + license source                                                        | Slice 1 |
| 6   | CMS choice for News + Case Studies, or MDX-in-repo?                                     | Slice 3 |
| 7   | Confirmed permission to keep named testimonial people on the new site?                  | Slice 1 |
| 8   | Analytics stack to carry over (GA4? Other?)                                             | Slice 0 |
| 9   | Are partner pages real content or off-site placeholders?                                | Slice 2 |
| 10  | Sentry — net new project or existing?                                                   | Slice 0 |

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
