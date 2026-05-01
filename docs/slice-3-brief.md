# Slice 3 — Dynamic Collections Brief

_Drafted 2026-05-01 by Claude (Opus 4.7) ahead of any code._

## TL;DR

The original Slice 3 plan was "custom CMS for Case Studies + News". After
inspecting the live Webflow site, **only News is actually a CMS
collection.** Case Studies is a single landing page with embedded
testimonial cards — no per-study detail pages.

Recommend splitting Slice 3 into:

| Sub-slice | Scope                                                             | Tier | Effort                                                |
| --------- | ----------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| **3a**    | Case Studies as a static page (typed content + video/photo cards) | 3    | Small (Slice-2 shape)                                 |
| **3b**    | News CMS — Supabase + admin + ~35 article migration               | 2    | Large — needs the open questions below answered first |

This drops the Tier-2 work to just News, and lets Case Studies ship next
session if you want a quick win.

---

## What's actually live

### Case Studies (`/case-studies`)

- **Single page**, no Webflow CMS collection. The sitemap has zero
  `/case-studies/[slug]` URLs.
- Content shape: hero ("Case Studies") + ~4 video testimonials + ~10
  written testimonials, each with `name`, `business`, `body` (and for
  videos a Bunny CDN URL). Approximately 13-15 entries.
- Already 70% covered by the home page Testimonials section — this
  page is essentially the expanded version with more written quotes.

### News (`/news`)

- **Real CMS collection**, ~35 article slugs in the sitemap.
- A handful are clearly Webflow auto-rename collisions (`-f15cf`,
  `-c6bb6`, `-8b515` suffixes) — likely deleted/recreated drafts. We
  should de-dupe at migration time.
- Each article needs a detail page (`/news/[slug]`).

---

## Slice 3a — Case Studies (static)

Same shape as Slice 2.

- **Public surface:** `/case-studies` only. No detail pages.
- **Data:** `src/lib/content/case-studies.ts` — typed array of:
  ```ts
  type CaseStudy = {
    name: string;
    business: string;
    kind: "video" | "written";
    videoUrl?: string; // for video kind, Bunny CDN until Slice 1c
    posterUrl?: string; // for video kind
    avatarUrl?: string; // for written kind, optional
    body?: string; // for written kind, multi-paragraph
  };
  ```
- **Components:** new `CaseStudyVideoCard.tsx` + `CaseStudyQuote.tsx`,
  composed by `app/case-studies/page.tsx`. Probably reuses `<video>`
  pattern from Testimonials.
- **Out of scope:** anything CMS-shaped. If the user later wants to
  edit case studies without a deploy, we revisit.

**One open question for 3a:**

- Q-CS-1: Are the existing ~13-15 testimonials the canonical set, or
  do you want to start fresh with a curated subset (e.g. 6 strongest)?
  My recommendation: ship all of them, prune later if the page feels
  long.

---

## Slice 3b — News CMS

The actual Tier-2 work. This is where the design questions stack up.

### Public surface

- `/news` — index, paginated or "load more"; sorted by `published_at` desc.
- `/news/[slug]` — detail page with cover, title, byline, body, and
  related articles or back-link.
- `/news/feed.xml` — RSS feed (cheap once data layer exists; nice for SEO).

### Data shape (Supabase table sketch)

```sql
create table news_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text not null,           -- format TBD: markdown vs html vs json
  cover_url       text,
  cover_alt       text,
  author          text,                    -- free text initially; FK to authors table later
  status          text not null default 'draft' check (status in ('draft','published','archived')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index news_posts_published on news_posts(status, published_at desc);
```

RLS: anon role can `select` rows where `status = 'published'`; service
role does everything else through the admin UI. Always paginate at the
service layer.

### Admin surface

- **Auth:** Supabase Auth, magic-link only (no passwords). Owner-only
  list initially — gated by an `app_users` table with a `role` column.
- **Routes:** `/admin/news` (list), `/admin/news/new`, `/admin/news/[id]`.
  Middleware blocks non-admins.
- **Editor UX:** the big design call. Three options, ranked by my
  recommendation:
  1. **Markdown + live preview** — content stored as markdown, rendered
     server-side with `remark-rehype`. Simple, durable, copy-pasteable.
     Best fit for a single-author blog.
  2. **Rich text (Tiptap / Lexical)** — WYSIWYG. Heavier dependency,
     more polish, riskier (state model + image embeds are non-trivial).
  3. **MDX** — markdown with embedded React components. Maximum power
     for marketing-style posts, but requires a build step on save and
     a sandbox for safe rendering. Probably overkill.

### Image pipeline

- Supabase Storage bucket `news-images`, public-read.
- Upload via signed URLs from the admin UI.
- Serve through `next/image` — Vercel handles transforms.
- Cover images: 1600×900 standard; thumbnails are derived.

### Publish workflow

MVP: `draft` → `published`. No previews of drafts (or: preview works for
admins via a `?preview=true` query param signed with a server token).
**Defer revisions / scheduled publishing** unless you say otherwise —
the editorial team is small.

### Migration of the 35 existing articles

This is the unsexy half of Slice 3b. Options:

1. **Manual rewrite** — paste each article into the admin UI. ~35
   articles × 5 min = 3 hours. Simplest, gives editorial chance to
   re-edit weak posts. **Recommended.**
2. **Scrape script** — pull each `/news/[slug]` HTML, extract
   article body, write a one-shot SQL migration that inserts all
   posts. ~2 hours to write, fragile against Webflow markup quirks.
3. **Webflow CMS export** — if user has admin access and can grab the
   CSV/JSON export, we can transform that. Cleanest if available.

Either way, the **slug map** is critical for SEO: every old
`/news/[slug]` must 301 to the new equivalent. The ~5 collision-suffix
slugs (`-f15cf` etc.) should redirect to their canonical version, not
both.

### SEO

- `generateMetadata` per article (title, description, OG image).
- Canonical URL.
- Article schema.org JSON-LD on detail pages.
- The redirect map merges into the Slice 5 cutover plan.

---

## Open questions — please answer before 3b code starts

1. **Q-NEWS-1: Editor UX.** Markdown + preview, rich text, or MDX?
   _My pick: Markdown._
2. **Q-NEWS-2: Who edits?** Owner-only, or multiple editors with
   roles? Affects auth model.
3. **Q-NEWS-3: Migration path.** Manual rewrite, scrape, or Webflow
   export? Affects timeline by ~3-6 hours.
4. **Q-NEWS-4: Drafts visible?** Should non-admins ever see a draft
   via signed preview URL, or is draft strictly admin-only?
5. **Q-NEWS-5: Comments / engagement.** Any plans for comments,
   reactions, or share counts? (Default: no.)
6. **Q-NEWS-6: Authors.** Single author for all posts, or per-post
   author byline? If multi, do they need profile pages?
7. **Q-NEWS-7: Categories / tags.** The live site doesn't appear to
   use them — keep flat, or add a tag system upfront? (Default: flat.)
8. **Q-NEWS-8: Search.** Any need for in-site search of news? (Default:
   no — Google handles it once cutover is done.)

---

## Recommended next step

Ship Slice 3a (Case Studies static) in one session — it's a clean
parallel to Slice 2. Then answer Q-NEWS-1..8 and start Slice 3b with a
detailed implementation plan.

Or, if you'd rather not split: answer the questions above and we go
straight at the full slice in one extended push.
