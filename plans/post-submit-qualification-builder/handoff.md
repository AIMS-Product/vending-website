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
- The next unblocked node is S2: Qualification form schema and services.
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

Launch or implement S2 with strict RED -> GREEN -> REFACTOR:

- add qualification form/question schemas and service contracts,
- prove draft publish creates immutable versions,
- prove default-form resolution and snapshot serialization,
- preserve existing page-builder block validation behavior,
- update `progress.md` only after evidence is accepted.
