# Admin Studio Design Contract

## Purpose

The Admin Studio is an operational CMS surface for creating, governing, and publishing content. It is not a marketing site, landing page, or decorative showcase. Admins should be able to scan state, make edits, verify readiness, and publish without learning implementation details.

This contract applies to `/admin/*` routes, including resource pages, blog/news, media, content libraries, future landing pages, and future campaign pages.

## Product Standard

- The UI should feel quiet, structured, and work-focused.
- Prioritize clarity, density, and repeat use over oversized hero sections or decorative layouts.
- Use restrained color. Color should communicate state, priority, or affordance.
- Prefer predictable admin patterns: sidebar navigation, tables, filters, drawers, modals, toolbars, and status panels.
- Avoid UI that requires the user to understand database fields, schema paths, route internals, or tracking implementation.

## Shell Rules

- Keep the left sidebar stable across admin content types.
- Keep the active section visually obvious.
- Planned sections can appear in navigation only when clearly marked as unavailable or later.
- Primary creation actions belong near the active list or work surface, not duplicated in multiple sidebar locations.
- Suppress public marketing header/footer on admin routes.
- Do not nest large cards inside page-section cards. Use full-width admin bands, tables, drawers, or individual item cards.
- Cards are acceptable for repeated items, modals, summary metrics, and genuinely framed tools.

## Lists And Tables

- Tables should support scanning first: title, key attributes, status, and actions. Keep columns lean — push per-record detail (such as updated/published dates) into the item's own editor/detail surface rather than widening the list.
- Actions menus should use familiar icons and concise labels.
- Filters should be segmented controls when the set is small and stable.
- Search should look like a search control, not a general text input.
- If a keyboard shortcut hint is shown, the shortcut must work.
- Empty lists must state what is empty and give one clear next action.

## Drawers, Modals, And Side Panels

- Use drawers for persistent governance or publish settings.
- Use modals for bounded decisions such as create flow, destructive confirmation, or detailed block settings.
- Do not put the primary authoring flow inside a modal when it belongs on the page canvas.
- Sticky action footers are preferred for long drawers.
- A collapsed drawer must not unmount required hidden values needed for save/publish.

## Language

- Use marketer-facing labels.
- Avoid raw schema labels such as `seo_title`, `blocks.0.props.heading`, `source_cta_tracking_name`, or UUIDs in normal UI.
- Error and readiness copy should describe the action the admin can take.
- Technical identifiers may appear only in deliberate advanced/debug surfaces.

## Controls

- Use icon buttons for common small actions: move, duplicate, remove, settings, collapse, expand, preview.
- Use text buttons for clear commands: save draft, publish, create, rollback.
- Use segmented controls for small option sets.
- Use toggles/checkboxes for binary settings.
- Use dropdowns/menus only for option sets that remain useful after reading the label.
- Do not use a generic select where a locked badge, status chip, or explicit action would better express the state.

## Responsive Requirements

- Admin routes must not create horizontal page overflow at common mobile, tablet, laptop, and desktop widths.
- Sticky rails and drawers must not cover form inputs or publish controls.
- Tables need mobile fallbacks: horizontal containment, stacked cards, or clearly scrollable containers.
- Text in buttons, chips, cards, and table cells must not overflow its container.

## Verification Requirement

Before declaring an admin UI change complete:

- Run the relevant code checks.
- Browser-test the real route.
- Capture or inspect desktop and mobile states when layout changes.
- Confirm no overlapping controls, hidden required actions, or misleading disabled states.
- Confirm the UI still works after save/reload when the change touches forms, drawers, or persisted content.
