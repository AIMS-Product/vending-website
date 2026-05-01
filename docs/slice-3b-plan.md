# Slice 3b — News CMS Implementation Plan

_Drafted 2026-05-01 by Claude (Opus 4.7) ahead of any code._
_Tier 2: introduces auth, RLS, file uploads, and a real backend._

## Decisions already locked

From the [Slice 3 brief](./slice-3-brief.md), per "go with suggestions":

| Q      | Decision                                                            |
| ------ | ------------------------------------------------------------------- |
| NEWS-1 | Markdown editor with live preview                                   |
| NEWS-2 | Owner-only auth, Supabase magic link, gated by an `app_users` table |
| NEWS-3 | Manual rewrite migration of the ~35 articles via the admin UI       |
| NEWS-4 | Drafts admin-only; no public preview URL                            |
| NEWS-5 | No comments / share counts                                          |
| NEWS-6 | Single author for now; `author` is a free-text field on the post    |
| NEWS-7 | Flat list — no tags / categories                                    |
| NEWS-8 | No in-site search                                                   |

## Prerequisites — needed from user before any code

This slice cannot start without:

1. **Supabase project** under the AIMS workspace.
   - I cannot create an account on your behalf — please:
     - Go to https://supabase.com → New Project → name it `vending-website`
       under the AIMS organization.
     - Pick the closest region (likely `us-west-1` if Mike's audience is US).
     - Generate a strong DB password and store it in 1Password.
   - Then share back:
     - `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://abcde.supabase.co`)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key)
     - `SUPABASE_SERVICE_ROLE_KEY` (the secret service-role key — **only**
       paste in the chat or 1Password, never commit)
2. **Admin email allowlist.** Which Google/email addresses should be able
   to sign in via magic link?
   - Default suggestion: `hello@jarve.com.au` (you) only at first; add
     Mike's address once it's known.
3. **Stack confirmations** (defaults below — say "ok" or override):
   - Markdown stack: `remark` + `remark-html` + `rehype-sanitize`
     (server-render). Client preview reuses the same pipeline.
   - Storage bucket name: `news-images`, public-read, 5 MB upload cap.
   - Article body container: 720px max-width, prose typography.
   - Cover image: 1600×900 minimum, displayed 16:9.

Once those three answers land, the work below proceeds in named commits.

## Sub-slices and commits

Each row is one PR-sized commit. Anything marked Tier 1 implies extra
checks (security, RLS, sanitisation tests).

| #     | Commit                                                              | Tier  | Notes                                                       |
| ----- | ------------------------------------------------------------------- | ----- | ----------------------------------------------------------- |
| 3b.1  | `feat: news cms — supabase wiring + zod env`                        | 2     | Deps, client factories, config, no DB yet                   |
| 3b.2  | `feat: news cms — schema migrations (news_posts + app_users + RLS)` | **1** | Tables, indexes, RLS policies + migration test              |
| 3b.3  | `feat: news cms — typed service layer + sanitised markdown render`  | 2     | `lib/services/news.ts`, `lib/markdown.ts`, unit tests       |
| 3b.4  | `feat: news cms — public /news index and /news/[slug]`              | 2     | Real pages reading from DB, with empty state                |
| 3b.5  | `feat: news cms — auth (magic link login + admin middleware)`       | **1** | `/admin` gate, `app_users` allowlist, session refresh       |
| 3b.6  | `feat: news cms — admin shell and post list`                        | 2     | `/admin/news` list + status filter + new-post button        |
| 3b.7  | `feat: news cms — markdown editor + draft/publish flow`             | 2     | Textarea + live preview tab, status toggle, server actions  |
| 3b.8  | `feat: news cms — image upload via signed urls`                     | **1** | Storage bucket + RLS + upload component + alt-text required |
| 3b.9  | `feat: news cms — rss feed at /news/feed.xml`                       | 3     | Cheap once data layer exists                                |
| 3b.10 | `docs: news cms migration handoff (35 articles to rewrite)`         | 3     | Markdown export from Webflow + a one-page how-to            |

## Detailed designs

### 3b.1 — Supabase wiring

- Install: `@supabase/ssr`, `@supabase/supabase-js`. (No need for the
  full CLI to be a project dep — we use it via npx for migrations.)
- Add env vars to Vercel via `printf '%s' '<value>' | vercel env add
--scope aimanagingservices ...` (never `echo`).
- Extend `src/lib/config.ts` Zod schema with the three new vars. The
  service role key never leaves server-only modules.
- Create `src/lib/supabase/{server,client,admin,middleware}.ts`:
  - `server.ts`: `createServerClient<Database>` for Server Components
    and Server Actions.
  - `client.ts`: browser singleton.
  - `admin.ts`: service-role client; imported only inside
    `server-only` modules. Used for storage uploads and admin writes.
  - `middleware.ts`: refreshes session in `middleware.ts` at the app
    edge.
- Add `src/middleware.ts` that calls `updateSession` and gates
  `/admin/*` routes.

### 3b.2 — Schema migrations

```sql
-- 0001_news_posts.sql
create table news_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text not null,                          -- markdown source
  cover_url       text,
  cover_alt       text,
  author          text,
  status          text not null default 'draft'
                  check (status in ('draft','published','archived')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index news_posts_published_idx
  on news_posts (status, published_at desc);

-- 0002_app_users.sql — admin allowlist
create table app_users (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text not null unique,
  role      text not null default 'editor' check (role in ('editor','admin')),
  added_at  timestamptz not null default now()
);

-- 0003_rls.sql
alter table news_posts  enable row level security;
alter table app_users   enable row level security;

-- public can read published rows only
create policy news_posts_anon_read
  on news_posts for select
  to anon, authenticated
  using (status = 'published');

-- only authenticated users in app_users can mutate posts
create policy news_posts_admin_write
  on news_posts for all
  to authenticated
  using   (exists (select 1 from app_users where user_id = auth.uid()))
  with check (exists (select 1 from app_users where user_id = auth.uid()));

-- app_users — only the row's own user can read it; no anon access
create policy app_users_self_read
  on app_users for select
  to authenticated
  using (user_id = auth.uid());

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger news_posts_updated_at before update on news_posts
  for each row execute function set_updated_at();
```

Then `supabase gen types typescript --project-id <id> >
src/types/database.ts`. Service layer always uses the typed client.

### 3b.3 — Service layer + markdown

```
src/lib/services/news.ts
  listPublished({ limit, cursor }): paginated read for /news
  getPublishedBySlug(slug): single read for /news/[slug]
  // admin (service-role)
  listAll({ status }): admin list
  getById(id)
  create({ title, slug, body, ... }): inserts as draft
  update(id, patch)
  publish(id) / unpublish(id) / archive(id)
src/lib/markdown.ts
  renderMarkdown(source): server-only, remark + rehype-sanitize → string
```

Sanitisation MUST run on every render. The `rehype-sanitize` default
schema is good; we extend it minimally to allow `<img>` with our
storage hostnames in `src` and `<a>` with rel/target attrs.

Tests: round-trip `<script>alert(1)</script>` and confirm it's stripped.
Round-trip a normal article (h2, p, ul, code, links, image) and confirm
it renders.

### 3b.4 — Public surface

- `app/news/page.tsx` — Server Component. Calls `listPublished({
limit: 20 })`. Renders title + excerpt + cover thumbnail per row.
  Empty state: "More stories coming soon" + Apply Now CTA.
- `app/news/[slug]/page.tsx` — Server Component.
  - `generateMetadata`: title, description (= excerpt), OG image (=
    cover_url).
  - `generateStaticParams` for all `published` slugs at build time, so
    individual articles render statically. ISR via `revalidatePath`
    on publish.
  - Renders cover, title, byline + published_at, sanitized HTML.
  - Falls back to `notFound()` if no row.
- Both pages render under the existing root layout.

### 3b.5 — Auth

- `app/admin/login/page.tsx` — magic link form. POSTs to a Server
  Action that calls `supabase.auth.signInWithOtp({ email })`.
- `middleware.ts` — `updateSession` for session refresh, plus a
  matcher that requires an authenticated user with a row in
  `app_users` for `/admin/*`. Anyone else gets `redirect('/admin/login')`.
- `lib/supabase/auth.ts` — `requireAdmin()` helper for Server
  Actions: throws if not in `app_users`. Layered defence on top of RLS.
- Session cookie: `httpOnly`, `Secure`, `SameSite=Lax` (the SSR
  package handles this).

### 3b.6 / 3b.7 — Admin UI

- `/admin/news` — table view: title, status (chip), updated_at, with
  filter chips (All / Drafts / Published / Archived). Header: New post.
- `/admin/news/new` — empty form. Slug auto-derived from title with a
  manual override field. Cover image upload control. Markdown body
  textarea + live preview tab.
- `/admin/news/[id]` — same form, populated. Adds Save draft / Publish
  / Unpublish / Archive buttons.
- All mutations are Server Actions returning `{ success, data?, error? }`.
- Optimistic UI deferred — the admin can wait 200ms.

### 3b.8 — Image upload

- Bucket `news-images`, public-read.
- RLS on `storage.objects`: anon may `select` (for serving), only
  members of `app_users` may `insert`/`update`/`delete`.
- Client upload via signed upload URL: server action returns a signed
  URL; client uploads directly. Server records the public URL on the
  post.
- File size cap 5 MB. MIME allowlist: `image/png`, `image/jpeg`,
  `image/webp`, `image/avif`.
- Alt text is required at upload time — the form blocks save without it.

### 3b.9 — RSS

`app/news/feed.xml/route.ts`. Pulls `listPublished({ limit: 50 })`,
emits a valid RSS 2.0 document with `<item>` per post (title, link,
guid = slug, pubDate, description = excerpt).

### 3b.10 — Migration handoff

By the time this commit lands, the admin works end-to-end. The user
manually pastes ~35 articles. Doc explains:

- where to find each article on the live site
- where to copy the cover image from
- the slug-mapping spreadsheet (old slug → new slug, used by the Slice
  5 redirect map)

## Total scope estimate

- ~10 commits across (probably) 3-4 sessions.
- Real risk areas: RLS test coverage (3b.2 + 3b.5), markdown
  sanitisation regressions (3b.3 + 3b.7), storage RLS (3b.8). Each of
  those gets unit tests before we move on.
- Out of scope (deferred): scheduled publishing, revisions, rich text
  toolbar, multi-author UI, comments, search.

## Stop signal

Once you've created the Supabase project and shared the three env
values + the admin email, I start at 3b.1 and grind through 3b.1
through 3b.4 in one session (public surface + read path), then pause
for a checkpoint before adding auth.

Authoring + image upload (3b.5–3b.8) is a separate session because
auth + storage RLS are where security mistakes happen, and I want a
clean head and a clean review for those.
