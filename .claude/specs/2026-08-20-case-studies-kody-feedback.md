# Case studies — Kody's round-one feedback

Handoff for a fresh session. The case studies CMS is **built, merged, and live**;
this is a revision pass on the index page and the article sidebar.

## Where things stand

- Repo `/Users/adamwolfe/vending-website`, branch `main`, deployed to
  www.vendingpreneurs.com
- `case_studies` table lives in Supabase project `aacisvhkmsaabqdvdmmf`
- **25 stories, all published.** Editing content is a database change, live in
  about a minute, no deploy needed
- Admin at `/admin/case-studies`

### Files that matter

| File                                           | What it owns                                                |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `src/app/case-studies/page.tsx`                | Index route: hero → CMS grid → quote wall → CTA             |
| `src/components/sections/CaseStudiesHero.tsx`  | Index eyebrow / H1 / subcopy                                |
| `src/components/sections/CaseStudyIndex.tsx`   | Filter chips + card grid                                    |
| `src/lib/case-studies/index-filters.ts`        | Facets, revenue bands, URL parsing (+ `.test.ts`, 13 tests) |
| `src/components/sections/CaseStudyCard.tsx`    | The card, shared by index and related rail                  |
| `src/components/sections/CaseStudyArticle.tsx` | **The one template every story renders through**            |
| `src/lib/content/case-studies.ts`              | Typed copy — all visible index copy must live here          |

---

## 1. Featured hero case study

Add a featured story directly below the site header, above the grid.

- Feature **Musa Sadi** (`/case-studies/musa-sadi`). Kody wrote it "Moosa" —
  **see the name question in Open Questions**
- Bigger treatment than a grid card: video or image, headline, the pull quote,
  the key numbers
- Do not hardcode the slug in the component. Either add a `featured` boolean
  column, or drive it from typed content so it can be swapped without a deploy.
  A hardcoded slug means a code change every time they feature someone new
- YouTube thumbnails stay for now. Kody wants cleaner photos eventually — the
  schema already has `cover_url` / `cover_alt`, which override the thumbnail, so
  no schema work is needed when the photos arrive

## 2. Index header copy

In `src/lib/content/case-studies.ts`, not inline in the component:

- Eyebrow → **Vendingpreneur Success Stories**
- H1 → **Real People Building Real Vending Routes**
- **Remove the subcopy** under the H1

## 3. Collapse the filters into one row

Today there are two rows (monthly revenue, then story type). Kody wants **one
row at the top of the grid**.

Verified counts straight from the database — they match Kody's numbers exactly:

| New chip           | Merges                                                               | Count |
| ------------------ | -------------------------------------------------------------------- | ----- |
| **Career Change**  | `career-change` (13) + `laid-off` (2) + `retiree` (1)                | 16    |
| **Family/Couple**  | `family-business` (9) + `couple` (5)                                 | 14    |
| **New to Vending** | `first-location` (5) + `route-acquisition` (5) + `no-experience` (5) | 15    |
| **Part Time**      | `part-time`                                                          | 11    |
| **Full Time**      | `full-time`                                                          | 2     |
| **Scaling**        | `scaling`                                                            | 20    |

Counts sum past 25 because stories carry several tags. That is expected.

Implementation notes:

- Map groups → underlying tags in `index-filters.ts`. **Do not rewrite the tags
  on the rows** — the raw tags stay useful for future regrouping, and rewriting
  them is destructive
- Kody said "one filter", so the **revenue band filter comes out** of the UI.
  Confirm before deleting `REVENUE_BANDS` — six stories have no
  `monthly_revenue_usd` at all, and `matchesRevenueBand` deliberately never
  matches null. Keeping the helper costs nothing
- Filtering is URL-based (`?tag=`), rendered as links, zero client JS, and every
  filtered view is crawlable. **Keep that.** Do not convert to client state
- `index-filters.test.ts` covers the current behaviour and will need updating
  alongside, not after

## 4. Card skimmability

Kody: _"cards look good but skimmability is rough."_ He wants the listed items
at the top of each card more visually distinct.

He is pulling repeatable details out of the transcripts to highlight, so **the
exact fields are not settled yet.** Two options:

- Wait for his list, then build once
- Or improve hierarchy now — the member name / role line is currently small
  uppercase tracking and competes with the title

Ask before building. This is the one item without a firm spec.

## 5. Replace "In this story" with route highlights

On the article page (`ArticleSidebar` in `CaseStudyArticle.tsx`), the sticky card
currently lists the four section headings. Kody wants highlights about the
member and their route instead — machines, months in the program, and similar.

**Data coverage is the catch.** Present on the 25 published rows:

| Column                | Coverage  |
| --------------------- | --------- |
| `prior_occupation`    | 24/25     |
| `monthly_revenue_usd` | 19/25     |
| `location_count`      | 18/25     |
| `machine_count`       | 15/25     |
| `months_to_result`    | **12/25** |

A fixed four-slot card will be visibly half-empty on many stories. Render only
the fields that exist and let the card shrink, the way `StatsStrip` already
does. Do not zero-fill — a story showing "0 machines" is worse than one not
mentioning machines.

**Also worth raising with Kody:** `StatsStrip` sits directly under the video and
already shows revenue / machines / locations / months. A highlights sidebar may
duplicate it. Options are to differentiate the two (sidebar = who they were and
their route shape; strip = headline numbers) or drop the strip. Flag it rather
than shipping the same four numbers twice.

---

## Open questions

1. **"Moosa" vs "Musa"** — Kody wrote "Moosa". `Musa Sadi` is a phonetic guess
   from auto-captions and was never confirmed. Kody's spelling may be the
   correct one. Confirm before featuring him at the top of the page.
   `Evan Tomahong` is also still unconfirmed.
2. **Card fields** — blocked on Kody's list of repeatable transcript details.
3. **Highlights vs stats strip** — see above.
4. **Revenue filter** — delete the UI, or keep it as a secondary control?

## Also outstanding

- **Delete `src/app/case-study-preview/page.tsx`.** It was scaffolding so Kody
  could review before the table existed. The real pages work now, so it has no
  purpose. Removing it also makes the `href` prop on `CaseStudyCard` and
  `cardHrefFor` on `CaseStudyArticle` dead — take those out too
- One story from the pack was never written: video `0vZjvyt9tZA` has no
  transcript. Needs Jess
- Site-wide soft 404: missing pages return HTTP 200. Pre-existing, unrelated to
  case studies, caused by the fully-dynamic builder catch-all plus the root
  `loading.tsx` committing a 200 before `notFound()` runs. Real SEO problem,
  deserves its own slice
- Revenue figures are unaudited member claims and names are phonetic unless
  confirmed. The source pack: _"If a number is going on the website next to a
  logo or a claim, run it past Jess first."_

## Gotchas this session cost time on

- **`next build` refuses to run while a dev server is up** (`scripts/guard-next-build.mjs`).
  It exits non-zero, so a `grep` for "Compiled successfully" comes back empty and
  looks like a pass. Kill the dev server, and check the exit code
- **Tailwind v4 variant ordering.** `min-[1832px]:grid-cols-…` lost the cascade
  to `xl:grid-cols-…`; the container widened but the columns did not, which
  left-aligned the whole grid. Fixed with a trailing `!`. Verify wide-screen
  layout in a real browser, not by reading classes
- **`rtk` mangles `grep` and piped `curl`.** It has silently reported zero
  matches and truncated output. Read files with Python when it matters
- **Scripts need env explicitly**: `node --env-file=.env.local scripts/…`
- **The service-role key cannot run DDL.** Any schema change (e.g. a `featured`
  column) must be pasted into the Supabase SQL editor by Adam. No database
  password or access token exists locally or in Vercel
- **ISR caches for 60s.** After a content edit, the first request may still show
  the old copy. Poll before concluding something failed
- Slugs deliberately keep the **old** name spellings (`/case-studies/tyrone-lewis`
  is Thyrone Lewis). Links are already public; do not rename without redirects

## Definition of done

- `npx tsc --noEmit` clean
- `npx vitest run` green (1517 tests at handoff), including updated filter tests
- `npm run build` compiles with a **zero exit code**, dev server stopped
- Wide (≥1832px) and 1440px screenshots of the index and one article page
- Filter chips verified against real counts, each chip's URL crawlable
- Verified on the deployed URL, not just locally
