# Handoff — Vendingpreneurs Webflow → Next.js Migration

_Last updated 2026-05-01. Use this to start a fresh Claude Code session
and pick up where we left off._

## TL;DR

Migrating https://vendingpreneurs.com from Webflow to a Next.js 16 site
on Vercel. Slices 0, 1a, 1b, 2, 3a, and **the public read path of Slice
3b** are shipped. The Supabase project is provisioned, schema is up,
and `/news` + `/news/[slug]` render from the database (empty state
visible at https://vending-website.vercel.app/news).

**Next: Slice 3b.5 — auth (magic link + admin middleware).** This is
Tier 1 — start it in a clean session with focused review. See
`docs/slice-3b-plan.md` for the full design.

## Project basics

| Item               | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Working directory  | `/Users/jamesaims/vending-website/`                                                 |
| GitHub repo        | `AIMS-Product/vending-website` (private)                                            |
| Vercel project     | `aimanagingservices/vending-website`                                                |
| Preview URL        | https://vending-website.vercel.app                                                  |
| Live (Webflow) URL | https://vendingpreneurs.com (still authoritative)                                   |
| Supabase project   | `vending-website` (ref `aacisvhkmsaabqdvdmmf`, AIMS org, us-west-1 / N. California) |
| Supabase dashboard | https://supabase.com/dashboard/project/aacisvhkmsaabqdvdmmf                         |
| Admin allowlist    | `james@modernamenities.com` (admin role) seeded in `app_user_emails`                |
| Stack              | Next.js 16, React 19, TS strict, Tailwind 4, Supabase, Vitest                       |

**AIMS conventions (from `~/.claude/CLAUDE.md`):**

- Vercel: always `--scope aimanagingservices`, never personal scope
- GitHub: under `AIMS-Product`, never personal accounts
- Next.js: APIs differ from training data — read `node_modules/next/dist/docs/`
  before writing Next-specific code (e.g. error.tsx uses `unstable_retry`,
  not `reset` in Next 16)
- Vercel env vars: never `echo` (appends `\n`); for preview env use
  `vercel env add NAME preview "" --value '...' --yes` (the empty `""`
  branch arg means "all preview branches" — the CLI hint is misleading)

## What's shipped

| Slice    | Scope                                                   | Status      |
| -------- | ------------------------------------------------------- | ----------- |
| 0        | Scaffold + preview deploy                               | ✅ shipped  |
| 1a       | Marketing shell + home page (placeholders)              | ✅ shipped  |
| 1b       | Real assets pulled from live Webflow                    | ✅ shipped  |
| 1c       | Cloudflare Stream video migration                       | ⏳ queued   |
| 2        | About + Terms + Privacy real content                    | ✅ shipped  |
| 3a       | Case Studies static page (all 14 testimonials)          | ✅ shipped  |
| 3b.1     | Supabase wiring + Zod env + client factories            | ✅ shipped  |
| 3b.2     | Schema migrations + RLS + email allowlist               | ✅ shipped  |
| 3b.3     | Service layer + sanitised markdown render + tests       | ✅ shipped  |
| 3b.4     | Public /news index + /news/[slug] (empty state visible) | ✅ shipped  |
| **3b.5** | **Auth — magic link + admin middleware (Tier 1)**       | ▶️ NEXT     |
| 3b.6     | Admin shell + post list                                 | queued      |
| 3b.7     | Markdown editor + draft/publish flow                    | queued      |
| 3b.8     | Image upload via signed URLs (Tier 1, storage RLS)      | queued      |
| 3b.9     | RSS feed at /news/feed.xml                              | queued      |
| 3b.10    | Migration handoff for ~35 articles                      | queued      |
| 4        | Lead capture (Apply Now / Contact)                      | needs brief |
| 5        | SEO + DNS cutover                                       | gated on 4  |

## File map — what changed in Slice 3b

```
src/
  lib/
    config.ts                 # Zod-validated env: NEXT_PUBLIC_SUPABASE_URL,
                              # NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
    markdown.ts               # unified pipeline (remark + rehype-sanitize)
    markdown.test.ts          # 10 vitest cases — XSS strip + valid HTML
    services/
      news.ts                 # listPublishedPosts, getPublishedPostBySlug,
                              # listPublishedSlugs (build-time anon client),
                              # adminCreate/Update/Publish/etc (service role)
    supabase/
      server.ts               # cookie-aware server client (Server Components)
      client.ts               # browser singleton ("use client")
      admin.ts                # service-role client (server-only)
  app/
    news/page.tsx             # ISR Server Component, calls listPublishedPosts
    news/[slug]/page.tsx      # SSG via generateStaticParams + generateMetadata
  components/sections/
    NewsHero.tsx, NewsList.tsx, NewsArticle.tsx
  types/
    database.ts               # Generated by `supabase gen types`
supabase/
  config.toml                 # local CLI config (linked to remote)
  migrations/
    20260501042413_init_news_cms.sql
docs/
  slice-3-brief.md            # static vs CMS split rationale
  slice-3b-plan.md            # 10-commit implementation plan
next.config.ts                # remotePatterns for Supabase Storage + Webflow CDN
vitest.config.ts              # node env, src/**/*.test.ts pattern
.env.local                    # gitignored — Supabase URL + anon + service role
```

## How to verify the project is healthy

```bash
cd /Users/jamesaims/vending-website
npm run typecheck
npm run lint
npm test                                      # 10 markdown tests should pass
npm run build                                 # 11 routes, /news Dynamic, /news/[slug] SSG
curl -sI https://vending-website.vercel.app/news | head -1   # expect 200
```

If `tsc` errors with stale `.next/types` references after route changes,
run `rm -rf .next && npm run typecheck`.

To pull env vars for a fresh checkout:

```bash
vercel env pull .env.local
# Then strip any literal \n from values that came in via echo (legacy)
```

To talk to the database directly without the CLI:

```bash
# Read app_user_emails as service role (verify allowlist):
SERVICE='<service-role-jwt-from-.env.local>'
curl -s "https://aacisvhkmsaabqdvdmmf.supabase.co/rest/v1/app_user_emails?select=*" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"
```

## Slice 3b.5 — kickoff prompt (paste into a new session)

```
Working on the Vendingpreneurs migration in /Users/jamesaims/vending-website/.
Read PLAN.md, HANDOFF.md, and docs/slice-3b-plan.md first to load context.

Slices 0, 1a, 1b, 2, 3a, and 3b.1–3b.4 are shipped. /news + /news/[slug]
read from Supabase and show the empty state at vending-website.vercel.app/news.

Start Slice 3b.5: auth — magic link login + admin middleware. This is
Tier 1 (security-shaped). Steps:

1. Add /admin/login page with a Server Action that calls
   supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
   '<site>/auth/callback' } }). Show a "check your email" confirmation.

2. Add /auth/callback route handler that exchanges the OAuth code for
   a session and redirects to /admin/news (or /admin/login on failure).

3. Add src/middleware.ts + src/lib/supabase/middleware.ts. Matcher
   covers /admin/:path* and /auth/:path* only — public marketing pages
   bypass middleware entirely. The middleware:
     a) refreshes the session via supabase.auth.getUser()
     b) for /admin/* routes, redirects to /admin/login if there's no
        user, OR if the user has no row in app_users.

4. Add a requireAdmin() helper in src/lib/supabase/auth.ts that:
     - calls supabase.auth.getUser() (NOT getSession — JWT can be spoofed)
     - throws / redirects if not signed in
     - looks up app_users via service role, throws if not present
   Use it in every /admin/* Server Component and Server Action as
   defence-in-depth on top of RLS.

5. Confirm magic-link signup auto-promotes via the trigger:
     - sign up at /admin/login with james@modernamenities.com
     - check that auth.users got a row
     - check that public.app_users got a matching row (auto-trigger)
     - confirm /admin (placeholder /admin/news page) renders for that user
     - sign out + try with a non-allowlisted email and confirm rejection.

6. Tests: write a small Vitest suite that mocks the Supabase client and
   verifies requireAdmin() rejects when:
     - no user
     - user not in app_users
     - user in app_users (positive case)

7. Verify build clean (npm run typecheck && lint && test && build).
   Commit "feat: news cms — auth + admin middleware (3b.5)" and push.
   Vercel auto-deploys. Visual-check by signing in.

Stop and ask before starting 3b.6 (admin UI). 3b.6–3b.8 are connected;
do them in one session if possible, with a checkpoint after 3b.7.
```

## Open items (not blocking 3b.5)

- **Slice 1c** — migrate 4 testimonial videos from Bunny CDN to
  Cloudflare Stream. Bunny works fine for now.
- **Slice 4** — Lead capture (Apply Now / Contact). Needs feature
  brief similar to slice-3-brief.md before code.
- **Q2** — DNS owner unknown. Investigate at Slice 5 via dig/whois.
- **Q10** — Sentry setup deferred until Chrome MCP is reachable, or
  invoke `/sentry-setup` skill.
- **GA4 measurement ID** — provision a property and add `NEXT_PUBLIC_GA_ID`.
- **News CMS migration** — once 3b.7 ships, paste the ~35 articles
  manually into the admin UI. Slice 3b.10 docs the exact process and
  produces the slug map for the Slice 5 redirect set.

## Recent commit history

```
b32de09 feat: news cms — public /news index and /news/[slug] (3b.4)
86f08d3 feat: news cms — service layer + sanitised markdown render (3b.3)
8bec59b feat: news cms — schema migrations + RLS (3b.2)
a59d795 feat: news cms — supabase wiring + zod env (3b.1)
a66b911 docs: slice 3b implementation plan (news cms)
8c35636 feat: slice 3a — case studies static page (locks 3b decisions)
c1b31c9 docs: slice 3 brief — split case studies (static) from news (CMS)
88005be feat: slice 2 — about/terms/privacy real content
```
