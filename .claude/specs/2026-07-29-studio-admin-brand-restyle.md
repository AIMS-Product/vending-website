# Studio admin — brand restyle (visual layer only)

Decided 2026-07-29. The Studio admin (`/admin`) looks unfinished next to the
public site. Restyle it to read as the same product, without losing the density
a data tool needs. **Visual/CSS layer only — no route, data, or behaviour
changes.**

---

## Read these first — they are contracts, not inspiration

`AGENTS.md` requires it before any `/admin` UI change:

- `docs/design/admin-studio.md`
- `docs/design/visual-review-checklist.md`
- `docs/design/page-builder.md` and `page-builder-blocks.md` (only if the
  builder surfaces are in scope)

If this restyle contradicts one of them, **update that doc in the same change**.
Do not silently diverge.

## The lever: one file, forty consumers

`src/components/admin/AdminUi.tsx` (346 lines) already is the shared design
layer, imported by **40 files**. It exports:

```
adminPanelClass  adminCardClass  adminInputClass  adminTextareaClass
adminLabelClass  adminPrimaryButtonClass  adminSecondaryButtonClass
adminSmallButtonClass  adminDangerButtonClass
AdminMetricPanel  AdminMetricStrip  AdminStatusBadge  AdminIcon
```

So this is **not** a build-a-design-system job. Retheme that file and most of
the admin moves with it. Only reach into individual pages for markup that
bypassed it (hardcoded `text-[#0b63f6]`, raw `<table>` styling, etc.).

Reference page: `src/components/admin/AdminLeadsManager.tsx` (755 lines).

---

## The real brand tokens

Read from the live public form (`src/components/forms/PublicLeadForm.tsx`) —
these are the actual values in production, not approximations:

| Token                   | Value                              | Where it earns its place                      |
| ----------------------- | ---------------------------------- | --------------------------------------------- |
| Ink                     | `#111111`                          | text, and `border-2` on anything that matters |
| Accent                  | `#f47b3b`                          | primary button fill, active nav, key numbers  |
| Offset shadow (cards)   | `8px 8px 0 #55b8e8`                | **the brand tell** — pale blue, not grey      |
| Offset shadow (buttons) | `5px 5px 0 #111111`                | primary/secondary buttons                     |
| Focus ring              | `#55b8e8` (border `#2d9fd6`)       | replaces every default focus ring             |
| Link                    | `#066a99`                          | replaces every default browser blue           |
| Radius                  | `8px` inputs/buttons, `12px` cards |                                               |
| Surface / muted         | white, `text-slate-500/600/700`    | already in use, keep                          |

Extract these into one source of truth (CSS variables or Tailwind theme
extension) and have `AdminUi.tsx` consume it. The public components should be
able to consume the same file later — don't hardcode a second copy.

**No dark mode.** Light only.
**No emojis.** Icons come from `AdminIcon` / Lucide.

---

## What is actually wrong right now

Judged from the Leads page, which is the worst offender and therefore the
reference implementation:

1. **Every status pill is the same pale amber.** "Qualified", "Completed",
   "Synced", "Contact captured", "Qualification pending", "In progress" and
   "None" are visually identical. A healthy row and a stalled row look the
   same. This is the single biggest failure — fix it first.
2. **The Close Sync pill is a full-width bar**, so the least interesting column
   is the loudest thing in the row.
3. **Default browser blue everywhere** — breadcrumb, active nav item, active
   filter tab, table links.
4. **Metric cards are generic**: hairline borders, pastel icon chips whose
   colours mean nothing.
5. **Rows are too tall.** Roughly ten fit on screen. Aim for fourteen-plus
   without crowding.
6. **The Source column renders `/` over a bare `A`.** The `A` is the variant
   key with no label — it reads as a rendering bug. Label it or drop it.
7. **The page description is printed twice** — once under the title, again
   inside the "Lead backstop" card.
8. **Numbers are not tabular**, so phone numbers and counts don't align.
9. **An unlabelled floating dark circle sits bottom-right** with no tooltip.
   Identify it; label or remove it.

## Direction

- **Status pills:** ink border, semantic tint fill, bold compact label.
  Green = healthy/synced/qualified. Amber = in progress/pending. Red = failed
  or needs review. Neutral grey = none/not applicable. The legend and the cells
  must use one shared component.
- **Metric cards:** white, ink border, `8px 8px 0 #55b8e8`, 12px radius, big
  ink number, accent orange on the primary metric only.
- **Buttons:** primary = orange fill + ink border + hard shadow; secondary =
  white + ink border + hard shadow; both collapse the shadow and translate on
  press. Danger keeps red.
- **Nav:** active item gets an orange left bar or filled pill with ink border.
  Group labels ("CONTENT") smaller, muted, letter-spaced. Items larger.
- **Tables:** stronger header row (uppercase, small, ink, subtle fill), zebra
  or clear hover, compact rows, right-aligned tabular numerals, "Inspect" as an
  ink text link with an icon.
- **Page header:** large display title; move meta into styled muted chips.

## Constraints

- Density wins over decoration. Fourteen-plus rows on screen at 1440px.
- WCAG AA. `#f47b3b` on white **fails** for small text — orange is for fills,
  bars, and large numerals only; small text stays ink.
- The hard offset shadow is for primary buttons, metric cards, and badges.
  **Never** on table rows or inputs — use a soft shadow on large data surfaces.
- Sidebar collapses cleanly; tables scroll horizontally when narrow.
- Behaviour, data, routes, copy meaning: unchanged.

## Verification

- `npx vitest run` — the suite is currently 1208 green, including
  `AdminLeadsManager.test.tsx`. Any test asserting a class string that changes
  must be updated deliberately, never deleted.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `design-qa` against the dev URL for visual, accessibility and contrast.
- Walk `/admin/leads`, `/admin/analytics`, `/admin/pages`, `/admin/forms`,
  `/admin/settings` before and after. Screenshot both.

## Process

1. Propose the token file plus three components — status pill, metric card,
   primary/secondary button — and **stop for approval**.
2. Then convert `/admin/leads` end to end as the reference.
3. Then the remaining pages, page by page.
4. Write `docs/design/MIGRATION.md`: how to apply the tokens and components to
   anything not yet converted, plus a note on every contrast fix made.

Prod is live and `main` deploys to it. Work on a branch; verify on a preview
before merging.
