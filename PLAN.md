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

### Slice 1 — Marketing shell + home page (Tier 3) — NEXT

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

### Slice 3 — Dynamic collections (Tier 3)

Case Studies, News. **Decision needed:** file-based MDX vs. headless CMS
(Sanity/Contentful/Payload). Recommend MDX-in-repo unless non-developers
need to publish.

### Slice 4 — Lead capture (Tier 1)

Apply Now + Contact → server action → real destination (CRM/email/Slack).

Required:

- Server-side Zod validation, never trust client
- Idempotency key per submission
- Audit row per submission
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

_(Empty — append decisions here as questions get answered.)_
