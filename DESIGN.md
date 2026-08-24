# Design

Two surfaces, two jobs. Don't mix them.

|          | Public site                                       | Admin Studio (`/admin/*`)                              |
| -------- | ------------------------------------------------- | ------------------------------------------------------ |
| Job      | Design **is** the product. Convert visitors.      | Design **serves** the product. Get out of the way.     |
| Language | Offset brutalist: ink borders, hard shadows, blue | Quiet tool: white surfaces, hairlines, one blue accent |
| Tokens   | `--brand-*`, `#111111`, `#2a8fcc`, `#55b8e8`      | `--ui-*`                                               |

The public language does not belong in the admin. It was tried, and a table of
hard-shadowed pills at fourteen rows reads as noise. The admin's only job is to
let someone scan state and act.

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
