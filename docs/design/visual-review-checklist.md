# Visual Review Checklist

## Purpose

Use this checklist before declaring Admin Studio or SEO Page Builder UI work complete. Automated checks are not enough for this surface. Browser evidence is required when the change affects layout, editing, controls, warnings, responsiveness, or publish flow.

## Required Context

Before reviewing:

- Read `AGENTS.md`.
- Read `docs/design/admin-studio.md`.
- Read `docs/design/page-builder.md`.
- Read `docs/design/page-builder-blocks.md` when the change touches blocks.
- For Next.js API or route work, read the relevant local docs under `node_modules/next/dist/docs/`.

## Desktop Review

Check the real route in a browser:

- No horizontal overflow.
- No overlapping controls.
- Text fits inside buttons, chips, cards, drawers, and table cells.
- Primary action is visually obvious.
- Secondary actions are available but not competing.
- Hover/focus states reveal editing controls without hiding content.
- Empty states guide the user toward the next action.
- Loading and error states do not expose raw implementation details.

## Mobile And Narrow Width Review

Check a narrow viewport when the route is admin/editor UI:

- Sidebar/drawer behavior is usable.
- Sticky controls do not cover fields.
- Tables or dense rows have an intentional mobile fallback.
- Long labels wrap or truncate deliberately.
- No required action is only reachable through hover.
- Canvas editing remains possible without layout overflow.

## Page Builder Canvas Review

For builder changes:

- Canvas looks like the page being edited, not a generic admin form.
- Public-facing copy is editable in place.
- Technical fields are not prominent in the canvas.
- Layout variants are not editable from the canvas after insertion.
- Block controls are visually secondary.
- Add section/add content controls do not collide with block toolbars.
- Field-level warnings are close to the affected field.
- SEO/readiness panel summarizes publish blockers.
- Save, reload, and re-open preserve the content.

## Block Review

For each changed block:

- Add or open a block of that type.
- Edit the main visible content.
- Save the draft.
- Reload the editor.
- Confirm the edited content persisted.
- Confirm layout/variant did not change accidentally.
- Confirm required-field warnings update correctly.
- If the block renders publicly, verify the public or preview render.

## Publish And Preview Review

When publish, preview, SEO, lead form, media, or routing behavior changes:

- Save draft.
- Open preview.
- Publish only with disposable or approved content.
- Verify public route renders expected content.
- Verify sitemap/robots behavior when relevant.
- Verify lead attribution when lead forms are involved.
- Clean up disposable records when the test creates them.

## Evidence Standard

The final implementation summary should include:

- Route(s) opened.
- Browser surface used.
- Key actions performed.
- Commands run.
- Any blocked checks and why.

Do not mark UI work complete if the browser view still has obvious overlap, misleading controls, raw technical labels, or unverified save/reload behavior.
