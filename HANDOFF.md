# Handoff — Vendingpreneurs Webflow → Next.js Migration

_Generated 2026-05-01. Use this to start a fresh Claude Code session and
pick up where we left off._

## TL;DR

We're migrating https://vendingpreneurs.com from Webflow to a Next.js 16
site on Vercel. Slices 0, 1a, and 1b are shipped. The home page on the
preview URL matches the original near-pixel-perfect. **Next slice: Slice
2** — pull About + Terms + Privacy real content from the live Webflow
site.

## Project basics

| Item               | Value                                             |
| ------------------ | ------------------------------------------------- |
| Working directory  | `/Users/jamesaims/vending-website/`               |
| GitHub repo        | `AIMS-Product/vending-website` (private)          |
| Vercel project     | `aimanagingservices/vending-website`              |
| Preview URL        | https://vending-website.vercel.app                |
| Live (Webflow) URL | https://vendingpreneurs.com (still authoritative) |
| Stack              | Next.js 16, React 19, TS strict, Tailwind 4       |

**AIMS conventions (from `~/.claude/CLAUDE.md`):**

- Vercel: always `--scope aimanagingservices`, never personal scope
- GitHub: under `AIMS-Product`, never personal accounts
- Next.js: APIs differ from training data — read `node_modules/next/dist/docs/`
  before writing Next-specific code (e.g. error.tsx uses `unstable_retry`,
  not `reset` in Next 16)
- Vercel env vars: never `echo` (appends `\n`); use `printf '%s' '…' |
vercel env add`

## What's shipped (3 slices)

**Slice 0 — Scaffold (Tier 3)**
Repo + Vercel project + auto-deploy from `main`. Required app-router
files. `lib/config.ts` with Zod env. Husky + lint-staged + tsc on commit.
Inter font via next/font. `@vercel/analytics` + speed-insights wired.
Sentry + GA4 measurement ID deferred (Chrome MCP wasn't reachable).

**Slice 1a — Marketing shell (Tier 3)**
All 5 home sections (Hero, BrandStrip, Benefits, AcceleratorProgram,
Testimonials, FinalCta), shared Header/Footer, pill Button primitive,
12 stub pages.

**Slice 1b — Real assets pulled (Tier 3)**
All imagery from live Webflow CDN. Partner nav externalized to
vendhub.ai (Q9 resolved during the pull). Stub pages for the 5 partner
routes deleted. `<video>` tags using existing Bunny CDN URLs (Cloudflare
Stream migration → Slice 1c).

## File map — what to know

```
src/
  app/
    layout.tsx              # Root layout: Header, main, Footer, analytics
    page.tsx                # Home — composes 6 section components
    apply/page.tsx          # Stub (Slice 4)
    about/page.tsx          # Stub (Slice 2 → fill next)
    case-studies/page.tsx   # Stub (Slice 3 — needs CMS)
    contact/page.tsx        # Stub (Slice 4)
    news/page.tsx           # Stub (Slice 3 — needs CMS)
    privacy/page.tsx        # Stub (Slice 2 → fill next)
    terms/page.tsx          # Stub (Slice 2 → fill next)
    error.tsx, global-error.tsx, loading.tsx, not-found.tsx
    globals.css             # Tailwind 4 + brand tokens (--brand-50…700)
  components/
    site/
      Header.tsx            # Transparent over hero, full primary nav
      Footer.tsx            # 4-column nav grid, supports external items
      NavLink.tsx           # Renders <a> for external, <Link> for internal
      Wordmark.tsx          # /brand/wordmark.png via next/image
      Stub.tsx              # "Coming soon" placeholder for unbuilt pages
    sections/
      Hero.tsx, BrandStrip.tsx, Benefits.tsx,
      AcceleratorProgram.tsx, Testimonials.tsx, FinalCta.tsx
    ui/
      Button.tsx            # Pill CTA with arrow chip; href OR onClick
  lib/
    config.ts               # Zod-validated env (server-only)
    utils.ts                # cn() helper
    content/
      home.ts               # Hero, partnerLogos, benefits, accelerator, finalCta
      nav.ts                # primaryNav + footerColumns (with external flags)
      testimonials.ts       # 6 testimonials with videoUrl/posterUrl/avatarUrl

public/
  brand/                    # wordmark.png, btn-arrow.svg, stars.svg, favicon
  images/sections/          # hero.avif, why.avif, accelerator.avif, cta.avif
  images/partners/          # 8 partner PNGs (alani-nu, cantaloupe, etc.)
  images/testimonials/      # 3 avatars + 4 video posters

.claude/rules/
  components.md             # Component conventions (path-scoped)
  pages.md                  # Page conventions (path-scoped)

PLAN.md                     # Migration plan, slice statuses, decisions log
HANDOFF.md                  # This file
```

## Plan summary (full detail in `PLAN.md`)

| Slice | Scope                                                 | Tier | Status                     |
| ----- | ----------------------------------------------------- | ---- | -------------------------- |
| 0     | Scaffold + preview deploy                             | 3    | ✅ shipped (polish queued) |
| 1a    | Marketing shell + home page (placeholders)            | 3    | ✅ shipped                 |
| 1b    | Real assets pulled from live Webflow                  | 3    | ✅ shipped                 |
| 1c    | Migrate testimonial videos to Cloudflare Stream       | 3    | ⏳ queued, low urgency     |
| **2** | **About + Terms + Privacy real content (narrowed)**   | 3    | ▶️ NEXT                    |
| 3     | Custom CMS for Case Studies + News (Supabase + admin) | 2    | needs detailed plan        |
| 4     | Lead capture (Supabase + Resend + Slack)              | 1    | needs detailed plan        |
| 5     | SEO + DNS cutover                                     | 1    | gated on Slice 4           |

## Slice 2 — kickoff prompt (paste into a new session)

```
Working on the Vendingpreneurs migration in /Users/jamesaims/vending-website/.
Read PLAN.md and HANDOFF.md first to load full context.

Slices 0, 1a, and 1b are shipped. Live preview at
https://vending-website.vercel.app matches the original Webflow home page.

Start Slice 2: pull About + Terms + Privacy real content from the live
site at https://vendingpreneurs.com. Steps:

1. curl the three pages:
   - https://vendingpreneurs.com/about-us
   - https://vendingpreneurs.com/terms
   - https://vendingpreneurs.com/privacy-policy

2. Extract the body copy (skip nav/footer chrome — those already live in
   our shared layout).

3. Add typed content modules under src/lib/content/{about,terms,privacy}.ts.

4. Replace src/app/{about,terms,privacy}/page.tsx — drop the Stub
   component and render real content using the existing component
   library (no inline JSX-string copy).

5. Add per-page metadata (title, description).

6. Verify: `npm run typecheck && npm run lint && npm run build`. Commit
   with a "feat: slice 2 — about/terms/privacy real content" conventional
   message and push. Vercel auto-deploys.

7. Visual-check the live preview (use computer-use screenshot if Chrome
   MCP is unreachable — open Google Chrome, navigate, screenshot at the
   tier-read level).

Out of scope for Slice 2 (deferred — do NOT do these):
- Case Studies / News (need Slice 3 custom CMS)
- Contact (rebuilt with the lead form in Slice 4)
- Sentry / GA4 polish (wait for Chrome MCP or do at cutover)

Stop and ask before starting Slice 3 or Slice 4 — both need a feature
brief first.
```

## Stack-specific gotchas (Next.js 16 / React 19 / Tailwind 4)

- **Next 16 error boundaries** use `unstable_retry`, NOT `reset`. The
  signature is `{ error, unstable_retry }: { error: Error & { digest? },
unstable_retry: () => void }`. See `src/app/error.tsx`.
- **Tailwind 4** uses `@theme inline { … }` in `globals.css` to map CSS
  variables to utility tokens. Brand colors are exposed as `text-brand-500`,
  `bg-brand-100`, etc. via `--color-brand-*`.
- **`server-only`** is imported in `src/lib/config.ts` to prevent the env
  module from leaking into client bundles.
- **`vercel deploy`** without `--prod` still uses `target=production` for
  the canonical alias — it's the same vercel.app URL, no custom domain.
  Webflow's vendingpreneurs.com is unaffected.
- **Pre-commit hook** runs `lint-staged` (eslint --fix + prettier) then
  `tsc --noEmit`. Don't bypass with `--no-verify`.

## Open items (still pending, not blocking Slice 2)

- **Q2** — DNS owner unknown. Investigate at Slice 5 via `dig`/`whois`
  against vendingpreneurs.com.
- **Q10** — Sentry setup deferred until Chrome MCP is reachable, or
  invoke `/sentry-setup` skill.
- **GA4 measurement ID** — provision a GA4 property and add
  `NEXT_PUBLIC_GA_ID` to `.env` + Vercel env. Code wiring not yet
  scaffolded.
- **Slice 1c** — migrate 4 Bunny CDN videos to Cloudflare Stream. Update
  `videoUrl` in `src/lib/content/testimonials.ts`. Bunny works fine for
  now.

## How to verify the project is healthy

```bash
cd /Users/jamesaims/vending-website
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build           # next build (produces 11 static routes)
curl -sI https://vending-website.vercel.app | head -1   # expect 200
```

If `tsc` errors with stale `.next/types/validator.ts` references after
deleting routes, run `rm -rf .next && npm run typecheck`.

## Recent commit history

```
4de6ecb feat: slice 1a — marketing shell + home page (placeholders)
912f8f4 docs: mark slice 1a shipped, queue slice 1b assets
61927ad feat: slice 1b — pull live Webflow assets, externalize partner nav
```

(Plus the chore commits for slice 0 scaffold + polish + decisions log.)
