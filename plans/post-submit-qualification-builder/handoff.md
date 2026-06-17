# Fresh Context Handoff: post-submit-qualification-builder

Use this file to continue the feature in a new Codex thread without relying on
chat history.

## Start Here

- Worktree: `/Users/jamesaims/Desktop/Development/vending-website-post-submit-qualification`
- Branch: `codex/post-submit-qualification-builder`
- Canonical folder: `plans/post-submit-qualification-builder/`
- Read in order:
  1. `AGENTS.md`
  2. `plans/post-submit-qualification-builder/decisions.md`
  3. `plans/post-submit-qualification-builder/plan.md`
  4. `plans/post-submit-qualification-builder/progress.md`
  5. `docs/design/admin-studio.md`
  6. `docs/design/page-builder.md`
  7. `docs/design/page-builder-blocks.md`
  8. `docs/design/visual-review-checklist.md`

## Current State

- The feature is in progress.
- S1 is complete: data model, RLS, generated types, schema/type test, and
  focused local migration proof are recorded in `progress.md` and
  `agent-runs/S1-attempt-1.md`.
- S2 is complete: qualification form schemas, normalized roles, snapshots,
  draft update, immutable publish, default resolution, and version-by-id
  services are recorded in `agent-runs/S2-attempt-1.md`.
- S3 is complete: short-contact qualification intake, local lead/session
  persistence, hashed token URL, Close ID reuse, attribution persistence, and
  pending Close sync event enqueueing are recorded in
  `agent-runs/S3-attempt-1.md`.
- S4 is complete: optional Close env config, mocked-fetch Close client,
  retryable sync event processor, duplicate handling, enrichment notes/custom
  fields, stale follow-up tasks, bounded sanitized errors, and protected Close
  sync runner route are recorded in `agent-runs/S4-attempt-1.md`.
- S5 is complete: public token lookup, immutable form loading, answer autosave
  and editing, resume state, required/consent completion validation, safe
  redirect fallback, Close enrichment event enqueueing, server actions, and a
  minimal noindex route shell are recorded in `agent-runs/S5-attempt-1.md`.
- S6 is complete: Image Gen-derived design spec, public Typeform-style runtime,
  all v1 question controls, dev/test demo token, route integration, and
  desktop/mobile browser proof are recorded in `agent-runs/S6-attempt-1.md`.
- The remaining unblocked W5 nodes are S7 admin forms builder and S8 page/block
  attachment settings.
- Close credentials are not available yet. This does not block local database,
  mocked Close adapter, retry queue, admin UI, or public runtime work. It blocks
  only final live Close boundary proof.

## How To Continue

- Use `feature-orchestrator` as the canonical flow.
- Keep `progress.md` authoritative.
- Workers write reports under `plans/post-submit-qualification-builder/agent-runs/`.
- Do not push, open a PR, trigger Vercel previews, or run remote DB migrations
  unless the user explicitly asks.
- For user-visible UI nodes, use `build-web-apps:frontend-app-builder` and
  browser screenshot proof before signoff.
- For Next.js route/action work, read relevant local docs under
  `node_modules/next/dist/docs/` before coding.

## Next Action

Choose and launch the next W5 node with strict RED -> GREEN -> REFACTOR:

- S7: admin qualification forms builder. Read the `/admin` design contracts
  before changing UI.
- S8: page/block attachment settings. Read the page-builder design contracts
  before changing editor UI.

Update `progress.md` only after fresh evidence is accepted.
