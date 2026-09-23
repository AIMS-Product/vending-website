# Design

Two surfaces, two jobs. Don't mix them.

|          | Public site                                       | Admin Studio (`/admin/*`)                              |
| -------- | ------------------------------------------------- | ------------------------------------------------------ |
| Job      | Design **is** the product. Convert visitors.      | Design **serves** the product. Get out of the way.     |
| Language | Offset brutalist: ink borders, hard shadows, blue | Quiet tool: white surfaces, hairlines, one blue accent |
| Tokens   | `--brand-*`, `ink`, `sky`, `tint`, `eyebrow`      | `--ui-*`                                               |

The public language does not belong in the admin. It was tried, and a table of
hard-shadowed pills at fourteen rows reads as noise. The admin's only job is to
let someone scan state and act.

## Public site accent rules (2026-09-22)

Orange is gone. On 2026-09-22 `/contact` dropped its orange accent and the
header CTA moved to blue (the `accent` prop was removed from `ApplyCtaButton`,
`ApplyHero`, `ApplyQuiz`, `PublicLeadForm` and `ApplyLandingPage`). The
2026-08-24 orange rules are retired. `#f47b3b` is not a public colour any more;
the few places it survives are bugs to remove as they are touched.

- **Button blue `--brand-700` / `#1f72a5`** — every filled CTA, white text.
  `--brand-600` (`#2a8fcc`) only clears 3.56:1 with white, below WCAG AA;
  `--brand-700` clears 5.24:1.
- **Accent blue `--brand-600` / `#2a8fcc`** — every non-button use: borders,
  highlights, icon badges, chips, backgrounds. Paired with ink or icons, never
  white body text.
- **Sky `#55b8e8`** (`sky`) — card shadows and focus rings.
- **Eyebrow `#066a99`** (`text-eyebrow`) — eyebrow text. The only one.
- **Ink `#111111`** (`ink`) — borders, headings, button shadows, dark bands.
- Red `#c2410c` is the required-field asterisk; red-600 is errors.

## Public site system

One design language for every public page, taken from the booking funnel
(`src/components/sections/apply/*`), the newest and most deliberate code. If a
page looks like a different site, it is using something outside this list.
Tokens live in `src/app/globals.css` `@theme`; primitives in
`src/components/ui/`.

### Tokens

| Token                                     | Value                 | Utility                                     |
| ----------------------------------------- | --------------------- | ------------------------------------------- |
| `--color-ink`                             | `#111111`             | `text-ink` `border-ink` `bg-ink`            |
| `--color-sky`                             | `#55b8e8`             | `ring-sky`                                  |
| `--color-tint`                            | `#eaf8ff`             | `bg-tint` (tint cards)                      |
| `--color-eyebrow`                         | `#066a99`             | `text-eyebrow`                              |
| `--radius-control` / `--radius-card`      | 8px / 12px            | `rounded-control` `rounded-card`            |
| `--shadow-btn` / `-hover`                 | 5px / 7px ink offset  | `shadow-btn`                                |
| `--shadow-card` / `-hover`                | 8px / 10px sky offset | `shadow-card`                               |
| `--container-page` / `article` / `narrow` | 1180 / 720 / 560px    | `max-w-page` `max-w-article` `max-w-narrow` |

Two radii, two shadow families. **Interactive = ink shadow, container = sky
shadow.** No other offset shadows, no other radii.

### Primitives

- `ui/Button` — `variant` primary (brand-700) / ghost (white) / onInk (white on
  a dark band, sky shadow); `size` md 48px (nav, cards) / lg 56px (hero, form
  submit, sticky bar). Never hand-roll a CTA class string.
- `ui/Card` — `variant` default (white, sky shadow) / tint / ink (at most one
  per page) / flat (border only: FAQ rows, rows inside a card). Never nest a
  bordered card inside another.
- `ui/Section` — `tone` white / tint / ink, `size` default (96px desktop,
  64px phone) / tight (64 / 48). Owns vertical rhythm; sections don't set
  their own `py-*`.
- `ui/Container` — `width` page / article / narrow, gutter 20px phone, 40px
  from `lg`. One left edge per page.
- `ui/Field` — `fieldClass` (52px, 8px radius, 2px ink border, 16px text so
  iOS never zooms, sky focus ring) and `FieldLabel` (14px above the field, red
  asterisk when required, "(optional)" otherwise). Inputs and selects share it.
- `ui/Highlight` — the money-phrase block (brand-600 fill, white text, 0.08em
  ink shadow). Inline-block, so it never paints over the line above.

### Type

Display H1 and section H2 are uppercase. Anton is the funnel and home
headline face; whether it becomes the site-wide face is an open decision
(slice 19), so don't spread it further until that lands. Body is Inter; 12px
is the floor for any text. Eyebrows: 12px, weight 800–900, `0.14em`
tracking, `text-eyebrow`, text only — a pill only when it carries state
("Step 02", "Good potential").

### Chrome

Paid-traffic booking pages (`isFunnelChromePath`) carry no site header or
footer; they end in the dark `ApplyDisclaimer` band. Marketing pages use the
site header and footer. Income-claim wording is Kody's and is never
reworded in a design change.

## Admin tokens

Defined in `src/app/globals.css`, exposed as Tailwind utilities
(`bg-ui-surface`, `text-ui-text-muted`, `border-ui-line`, `rounded-ui`,
`shadow-ui`). Never write raw hex in an admin component.

| Token                               | Value     | Use                                            |
| ----------------------------------- | --------- | ---------------------------------------------- |
| `--ui-canvas`                       | `#f6f7f9` | page background, table header fill, hover rows |
| `--ui-surface`                      | `#fdfdfe` | cards, tables, sidebar items, inputs           |
| `--ui-sidebar`                      | `#fafbfc` | sidebar, one step cooler than content          |
| `--ui-line`                         | `#e5e8ed` | every divider and card border                  |
| `--ui-line-strong`                  | `#d3d8e0` | input and button borders                       |
| `--ui-text`                         | `#12161f` | primary text                                   |
| `--ui-text-muted`                   | `#5b6472` | descriptions, secondary rows                   |
| `--ui-text-subtle`                  | `#8a92a1` | eyebrows, captions, placeholders               |
| `--ui-accent`                       | `#0b63f6` | primary button, active nav, links              |
| `--ui-accent-soft`                  | `#eef4ff` | active nav fill                                |
| `--ui-ok` / `warn` / `bad` / `idle` |           | status dots only                               |

Neutrals are tinted a few points toward the accent hue. Nothing is `#000` or
`#fff`.

Radii: `--radius-ui` 6px (controls), `--radius-ui-lg` 8px (cards). Two only.
Shadows: `--shadow-ui` (everything), `--shadow-ui-raised` (dialogs). Two only.

## Rules

- **Status is a soft tinted chip.** Pale fill, deep ink of the same hue, the
  word always present. The whole chip carries the colour because a bare dot
  is too small to pick out when scanning a long column. Keep the fills pale:
  the chips should be readable at a glance without out-shouting the data.
  One component owns it, `AdminStatusBadge`, so a legend and a table cell can
  never drift apart.
- **One filled control per screen.** The primary button. Everything else is a
  bordered surface or plain text.
- **Selection is a soft fill,** never a coloured edge bar.
- **Type scale is fixed rem, ratio ~1.2.** Page title 22px semibold. Body 14px.
  Dense rows and labels 13px. Eyebrows 11px uppercase, `0.08em` tracking.
- **Numbers are `tabular-nums`.** Counts, phone numbers, dates, percentages.
- **A magnitude bar is one hue, and length is its only encoding.** `AdminBar`
  owns it. Don't tint a bar darker because it is longer: that spends the colour
  channel restating what the length already says. Don't put a track behind it
  either. A full-width grey rail under every row is identical on every row, so
  the eye anchors on the rail instead of the fill and a 25% row stops looking
  different from a 2% row. Without a track the panel's silhouette is the
  ranking. Bars are square where they start and rounded only at the data end,
  so a short bar reads as short instead of as a pill.
- **Two series get a legend; one series doesn't.** With a single colour the
  panel title already says what is plotted, and a one-swatch key is ink that
  explains nothing.
- **Density over decoration.** Table rows at `py-2.5`. Fourteen-plus rows on a
  1440px screen.
- **No dark mode. No emojis.** Icons come from `AdminIcon`.

## Where the system lives

`src/components/admin/AdminUi.tsx` is the shared layer, imported by ~40 files.
Retheming it moves the whole admin. If a page needs a button, card, input,
status or metric, import it from there. If you find yourself writing a new
button shape in a page, that's the bug.

`src/components/admin/AdminShell.tsx` owns the sidebar, page header and
confirmation dialog.

## Not yet converted

Page-specific markup in some `/admin` screens still hardcodes `#0b63f6` and
`slate-*` utilities. Those values are deliberately near-identical to the tokens
so nothing looks broken mid-migration, but they should be swapped to `--ui-*`
as each page is touched.
