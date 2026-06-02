# Decisions: website-builder-feedback-v2

## Confirmed Decisions

- 2026-06-02: Feature graph work must stay in the `feature-orchestrator` flow. Stage skills are used only as explicit orchestrator stages, with worker evidence under `agent-runs/` and `progress.md` updated by the orchestrator.

## Safe Defaults

- 2026-06-02: S2 page types can start with marketer-facing choices for SEO/resource, blog, landing, and video pages while preserving resource as the backward-compatible default.
- 2026-06-02: S2 template support should use approved, locked template definitions made from existing validated page-builder blocks. It must not introduce arbitrary HTML, freeform layout controls, or route-prefix changes.
- 2026-06-02: S2 can store `page_type` and `template_key` through the existing `seo_pages` columns. Route prefixes, duplicate pages, content-library capture, full blog authoring, and custom footer/form work remain in later graph nodes.
- 2026-06-02: S3 route-prefix defaults are `/resources` for SEO/resource pages, `/blog` for blog pages, `/landing` for landing pages, `/videos` for video pages, and `/solutions` as an allowed manual override. Prefixes remain editor-selectable before publish.
- 2026-06-02: S3 duplicate-page drafts should not use `{original-slug}-duplicate`. Use a draft-only placeholder slug format such as `draft-{shortid}`, reset published state, and require the editor to set a publish-safe slug/title before public use.

## Open Questions

- None for S3.

## Rejected Options

- 2026-06-02: Do not implement S2 through a standalone implementation skill outside the orchestrator flow.
