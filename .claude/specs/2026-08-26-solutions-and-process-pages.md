# Solutions + Process pages — build-out spec

Written 2026-08-26, immediately after `/solutions/vendscout` shipped to production
(`119b198`). Everything below is verified against the running code, not recalled.

## What already exists

`/solutions/vendscout` is live. It is rendered by a **data-driven template** — adding a
solutions page is adding one object, not building a page:

| File                                       | Role                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/lib/content/solutions.ts`             | The registry. One `Solution` object per page. Types are documented inline.           |
| `src/components/sections/SolutionPage.tsx` | The template. Renders every field; skips sections whose data is empty.               |
| `src/app/solutions/[slug]/page.tsx`        | Route. `generateStaticParams` + metadata read the registry. `dynamicParams = false`. |
| `src/app/solutions/page.tsx`               | Index, driven by `solutionsIndex` + the registry.                                    |
| `src/lib/content/solutions.test.ts`        | Guards slugs, required fields, internal links, and video dimensions.                 |

Section order in the template: hero (breadcrumb, eyebrow, h1, intro, CTAs, media) ·
proof (3 testimonial cards, **skipped while empty**) · thesis + 3 numbered steps ·
alternating feature blocks (eyebrow, h2, body, checklist, media) · closing CTA card ·
related cards.

## THE TRAP — read before adding any `/solutions/*` page

`/solutions` is one of the five **seeded Page Builder route prefixes**
(`src/lib/page-builder/route-prefix-defaults.ts`). `src/proxy.ts` 404s any two-segment
path under a builder prefix that has no published `seo_pages` row — **before the app
route ever runs**. A coded page must be registered in `CODED_ROUTE_PATHS`
(`src/lib/page-builder/coded-route-paths.ts`).

That file now derives its `/solutions/*` entries from `listSolutionSlugs()`, so adding a
solution stays a one-file change. **Do not hand-add slugs there.** Do verify a new page
returns 200 from a real server (`next build && next start`), not just from `next dev` —
dev and prod route differently enough to hide this.

`/process/*` is **not** a builder prefix, so it takes the `handleCustomBuilderPath`
branch, which terminates in `NextResponse.next()` for an unconfigured prefix. It should
pass through — but verify it with a built server before writing seven pages on the
assumption.

## Pages to build

Priority and target dates are Adam's, from the tracking sheet.

**Solutions (High, all under `/solutions/`)** — one registry object each:
`marketplace` (Product Marketplace) · `equipment` · `national-contracts` ·
`coaching` (Professional Coaching) · `partners` (Partner Network) · `financing` ·
`support` (Expert Customer Support). `vendscout` (Find Locations) is done.

**Process (Moderate)** — `/process/` index plus seven children:
`find-locations` · `choose-machines` · `pitch` · `contract` · `select-products` ·
`optimize` · `scale`.

Process pages are a _different shape_ from solutions — they teach a step, they do not
sell a product. Decide deliberately whether they reuse `SolutionPage` (cheap, and the
field names mostly fit) or get their own sibling template driven by the same pattern.
Do not fork the template by copy-paste; if a second template is right, extract what
both share.

## Media

`SolutionMedia` takes `src` (still), or `video` + `poster` + `width` + `height`, or
neither — with neither it draws a bordered frame labelled with `alt`, so **copy can ship
before assets exist**. That is the intended path for this build-out.

Videos are `preload="none"`, so only posters cost anything on load. **`width`/`height`
are mandatory for a video** — the frame takes its ratio from them. The VendHub
recordings are 1700x1080, and a fixed 16:9 frame pillarboxes them with black bars;
`solutions.test.ts` fails if a video is missing its dimensions.

Public VendHub walkthrough clips, all at
`https://www.vendhubhq.com/sales/videos/<name>.mp4` with a matching `<name>-poster.jpg`
(source: https://www.vendhubhq.com/walkthrough):

`vendscout-v1` · `scout-map` · `scout-pipeline` · `scout-contracts` · `scout-mockups` ·
`scout-flyers` · `website` · `scout-outbound` · `scout-chat` · `scout-routes` ·
`lytics` · `equipment` · `pantry`

Four are already used by `vendscout`. `equipment` and `pantry` are obvious fits for the
Equipment and Product Marketplace pages. Probe real dimensions per file before wiring —
they are not all identical (`vendscout-v1` is 1700x1032, the others 1700x1080).

## Copy sources

`src/lib/content/` is the house voice — `home.ts`, `about.ts`, `apply-page.ts`,
`lead-magnets.ts`. `data/case-studies/*.json` and `docs/case-studies/` carry real
operator outcomes. Read a few before writing; the site's register is concrete and
plain — no hype, no em-dash-joined slogans.

**Do not invent testimonials.** The source design for `vendscout` shipped with
placeholder quotes; they were left out and the section renders only once real quotes
exist. Hold that line for every new page.

## Design + copy constraints

- `DESIGN.md` governs. Public site is offset brutalist: 2px `#111111` borders, hard
  offset shadows, black uppercase headings, `#f5fbff` / white alternating sections.
- **Accent rule:** orange `#f47b3b` is reserved for the top-nav CTA and `/contact`
  only. Every other filled button is `bg-brand-700`. Non-button blue is `brand-600`.
- Reuse `@/components/ui/Button` — do not write a new button shape.
- No emojis. No dark mode.
- `/apply` 301s to `/contact` — never link `/apply`.

## Nav

`src/lib/content/nav.ts` carries Kody-approved labels with his instructions in
comments. `/solutions` is **not** in the nav yet. Adding it is Adam's call — ask, do
not assume.

## Verification

`npm run typecheck` · `npx eslint <files>` · `npm test` · `npm run build`.
Then `npx next start` and curl each new path for a 200 — the proxy trap above is
invisible to `next dev` and to the build output.

Stop the dev/prod server before `npm run build`; `scripts/guard-next-build.mjs` refuses
to build while one is running, and stale `.next/dev/types` will fail `typecheck` with
phantom missing-module errors after a branch switch (`rm -rf .next/dev/types`).

## Shipping

`main` is the release branch and **pushes to it publish straight to
www.vendingpreneurs.com**. Branch, push the branch, check the Vercel preview, then ask
Adam before merging.
