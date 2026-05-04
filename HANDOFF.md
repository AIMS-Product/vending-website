# Handoff — Vendingpreneurs Webflow → Next.js Migration

_Last updated 2026-05-04. Use this to start a fresh Claude Code session
and pick up where we left off._

## TL;DR

Migrating https://vendingpreneurs.com from Webflow to a Next.js 16 site
on Vercel. Slices 0, 1a, 1b, 2, 3a, and **Slice 3b News CMS** are
implemented through the admin editor, signed image uploads, RSS, and
migration handoff docs. The Supabase project is provisioned, schema is up,
`/news` + `/news/[slug]` render from the database, and `/admin/news` is
magic-link gated.

**Next: resolve the real admin email deliverability/Auth issue before handing
CMS access to Mike.** Browser testing showed Supabase Auth rejects
`james@modernamenities.com` with `email_address_invalid`, even though the row is
allowlisted in `app_user_emails`. A temporary Gmail-shaped test admin verified
the app flow itself. After that, the next implementation slice is Slice 4 —
lead capture — which is Tier 1 and needs its own brief before code.

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

| Slice | Scope                                                   | Status      |
| ----- | ------------------------------------------------------- | ----------- |
| 0     | Scaffold + preview deploy                               | ✅ shipped  |
| 1a    | Marketing shell + home page (placeholders)              | ✅ shipped  |
| 1b    | Real assets pulled from live Webflow                    | ✅ shipped  |
| 1c    | Cloudflare Stream video migration                       | ⏳ queued   |
| 2     | About + Terms + Privacy real content                    | ✅ shipped  |
| 3a    | Case Studies static page (all 14 testimonials)          | ✅ shipped  |
| 3b.1  | Supabase wiring + Zod env + client factories            | ✅ shipped  |
| 3b.2  | Schema migrations + RLS + email allowlist               | ✅ shipped  |
| 3b.3  | Service layer + sanitised markdown render + tests       | ✅ shipped  |
| 3b.4  | Public /news index + /news/[slug] (empty state visible) | ✅ shipped  |
| 3b.5  | Auth — magic link + admin middleware (Tier 1)           | ✅ shipped  |
| 3b.6  | Admin shell + post list                                 | ✅ built    |
| 3b.7  | Markdown editor + draft/publish flow                    | ✅ built    |
| 3b.8  | Image upload via signed URLs (Tier 1, storage RLS)      | ✅ built    |
| 3b.9  | RSS feed at /news/feed.xml                              | ✅ built    |
| 3b.10 | Migration handoff for ~35 articles                      | ✅ built    |
| 4     | Lead capture (Apply Now / Contact)                      | needs brief |
| 5     | SEO + DNS cutover                                       | gated on 4  |

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
    news/feed.xml/route.ts    # RSS feed
    admin/news/page.tsx       # gated post list
    admin/news/new/page.tsx   # new post editor
    admin/news/[id]/page.tsx  # edit post editor
  components/sections/
    NewsHero.tsx, NewsList.tsx, NewsArticle.tsx
  components/admin/
    NewsEditorForm.tsx        # markdown editor + live preview + image upload
  types/
    database.ts               # Generated by `supabase gen types`
supabase/
  config.toml                 # local CLI config (linked to remote)
  migrations/
    20260501042413_init_news_cms.sql
    20260504084000_news_images_storage.sql
docs/
  slice-3-brief.md            # static vs CMS split rationale
  slice-3b-plan.md            # 10-commit implementation plan
  news-cms/migration-handoff.md
next.config.ts                # remotePatterns for Supabase Storage + Webflow CDN
vitest.config.ts              # node env, src/**/*.test.ts pattern
.env.local                    # gitignored — Supabase URL + anon + service role
```

## How to verify the project is healthy

```bash
cd /Users/jamesaims/vending-website
npm run typecheck
npm run lint
npm test                                      # markdown + auth tests should pass
npm run build                                 # includes /admin/news, /news/feed.xml, /news/[slug]
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

## Next kickoff prompt (paste into a new session)

```
Working on the Vendingpreneurs migration in /Users/jamesaims/vending-website/.
Read PLAN.md, HANDOFF.md, and docs/slice-3b-plan.md first to load context.

Slices 0, 1a, 1b, 2, 3a, and 3b are implemented locally. First verify
the News CMS deployment end to end:

1. Use an admin email accepted by Supabase Auth, or fix
   `james@modernamenities.com` deliverability/domain validation.
2. Sign in at /admin/login.
3. Create a draft post, upload a cover image, preview markdown, publish,
   confirm it appears on /news and /news/<slug>, then unpublish/archive.
4. Confirm /news/feed.xml returns valid RSS.
5. Update any docs if verification finds drift.

Then draft the Slice 4 lead-capture brief before code. This is Tier 1:
Apply Now and Contact cannot silently lose leads.
```

## Open items (not blocking 3b verification)

- **Slice 1c** — migrate 4 testimonial videos from Bunny CDN to
  Cloudflare Stream. Bunny works fine for now.
- **Slice 4** — Lead capture (Apply Now / Contact). Needs feature
  brief similar to slice-3-brief.md before code.
- **Q2** — DNS owner unknown. Investigate at Slice 5 via dig/whois.
- **Q10** — Sentry setup deferred until Chrome MCP is reachable, or
  invoke `/sentry-setup` skill.
- **GA4 measurement ID** — provision a property and add `NEXT_PUBLIC_GA_ID`.
- **News CMS migration** — paste the ~35 articles manually into the admin UI
  using `docs/news-cms/migration-handoff.md`, producing the slug map for the
  Slice 5 redirect set.
- **Supabase Auth admin email** — `james@modernamenities.com` is allowlisted
  locally/remotely in `app_user_emails`, but Supabase Auth currently rejects it
  during `signInWithOtp` with `email_address_invalid`.

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
