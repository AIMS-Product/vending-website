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
- The next unblocked wave is W4: S4 Close adapter/sync runner and S5 public
  qualification backend route/actions.
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

Launch W4 with strict RED -> GREEN -> REFACTOR:

- S4 should add mocked Close adapter behavior, sync-event processing, retry
  state transitions, and optional env config without live Close credentials.
- S5 should add token-based public qualification backend route/actions for
  loading sessions and saving step answers against immutable form versions.
- S4 and S5 can run in parallel only if write scopes stay disjoint and
  integration verifies the shared event/session contracts.
- update `progress.md` only after evidence is accepted.
