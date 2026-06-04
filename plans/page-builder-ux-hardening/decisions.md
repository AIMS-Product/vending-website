# Decisions: page-builder-ux-hardening

## Confirmed Decisions

- 2026-06-05: User approved starting the behavior-preserving UX hardening workflow after asking which skill to use.

## Safe Defaults

- Preserve existing autosave, manual save, preview, publish validation, route-prefix path generation, author/redirect form field names, and public renderer behavior unless a graph node explicitly says otherwise.
- Treat `reports/ux-persona-review/UX-REVIEW.md` as audit input, not current truth; reproduce each finding before implementation.
- Use existing design contracts as the source of routine UX defaults.
- Keep the work local-only. Do not push, open PRs, create Vercel previews, deploy, publish existing pages, delete records, or mutate production data without explicit user instruction.
- For copy-link failure, use a manual selectable URL fallback rather than relying only on Clipboard API permissions.
- For editor publish safety, use a confirmation step only when publish is otherwise allowed; blocked publish keeps focusing the existing next-step reason.
- Treat the black `N` bubble in local screenshots as the Next.js development indicator, not an app-rendered admin avatar. Do not patch app UI for that dev-only overlay.

## Open Questions

- None for S1-S7. Full undo/redo, drag-and-drop, import/migration paths, and keyboard command systems are out of scope unless the user explicitly expands the graph.

## Rejected Options

- Do not repair stale historical issues that no longer reproduce in the current app.
- Do not solve editor density by removing required SEO/governance fields from the data model.
- Do not change public rendering semantics to fix the dev-only block-preview audit route unless audit-route containment cannot preserve semantics.
