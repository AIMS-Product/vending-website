# Decisions: website-builder-feedback-v2

## Confirmed Decisions

- 2026-06-02: Feature graph work must stay in the `feature-orchestrator` flow. Stage skills are used only as explicit orchestrator stages, with worker evidence under `agent-runs/` and `progress.md` updated by the orchestrator.
- 2026-06-03: Scheduled pages should auto-publish unattended when their scheduled time arrives, not merely move to a manual review queue. The runner must be server-side, protected, idempotent, and must re-run normal publish gates immediately before publishing.
- 2026-06-03: Scheduled publishing should use Vercel Cron hitting a protected Next.js route. Add a cron route such as `/api/admin/scheduled-publishing/run`, protect it with a scheduler secret or Vercel cron auth, and keep publish execution inside the existing app/service layer.
- 2026-06-03: Scheduled publishing UI should use American West Coast time, implemented as `America/Los_Angeles`, for admin entry and display. Store scheduled timestamps internally as UTC/timestamptz.
- 2026-06-03: Failed scheduled publishes do not need active email/Slack notifications in v1. Dashboard failure state plus readable `scheduled_publish_error` is enough; admins can edit, cancel, or reschedule from the CMS.
- 2026-06-03: Scheduled publishing should support both first-time draft publishes and scheduled updates to already-published pages. For published pages, the existing live page stays live until the scheduled draft is successfully published as the next revision. If scheduled update fails, the old live page remains live.

## Safe Defaults

- 2026-06-03: During feature intake, use strong technical defaults for routine engineering decisions when the recommendation is sound. Only stop the user for proper product/design choices or decisions that materially affect live data, permissions, state transitions, external contracts, destructive behavior, migration direction, or customer-visible behavior.
- 2026-06-03: Scheduled publishing runner should use standard guarded retry behavior. Readiness/publish-gate failures mark the page `failed` and require admin edit/reschedule before retry. Transient system failures can retry up to a small fixed cap, with `scheduled_publish_attempts`, `scheduled_publish_last_attempt_at`, and `scheduled_publish_error` recorded. Successful runs set status to `published` and clear errors. Cron execution must be idempotent.
- 2026-06-03: Scheduled publishing cron should run frequently enough for admin expectations without implying exact-to-the-second delivery. Recommended implementation default is every 5 minutes unless Vercel plan limits or deployment constraints require a wider interval.
- 2026-06-03: Store scheduled publish timestamps as UTC/timestamptz internally. The UI should show an explicit timezone label rather than relying on implicit browser behavior.
- 2026-06-02: S2 page types can start with marketer-facing choices for SEO/resource, blog, landing, and video pages while preserving resource as the backward-compatible default.
- 2026-06-02: S2 template support should use approved, locked template definitions made from existing validated page-builder blocks. It must not introduce arbitrary HTML, freeform layout controls, or route-prefix changes.
- 2026-06-02: S2 can store `page_type` and `template_key` through the existing `seo_pages` columns. Route prefixes, duplicate pages, content-library capture, full blog authoring, and custom footer/form work remain in later graph nodes.
- 2026-06-02: S3 route-prefix defaults are `/resources` for SEO/resource pages, `/blog` for blog pages, `/landing` for landing pages, `/videos` for video pages, and `/solutions` as an allowed manual override. Prefixes remain editor-selectable before publish.
- 2026-06-02: S3 duplicate-page drafts should not use `{original-slug}-duplicate`. Use a draft-only placeholder slug format such as `draft-{shortid}`, reset published state, and require the editor to set a publish-safe slug/title before public use.

## Open Questions

- None for scheduled publishing runner planning.

## Rejected Options

- 2026-06-02: Do not implement S2 through a standalone implementation skill outside the orchestrator flow.
