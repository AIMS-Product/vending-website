# Prompt For Fresh Codex Thread

Continue the post-submit qualification builder feature in:

`/Users/jamesaims/Desktop/Development/vending-website-post-submit-qualification`

Use the `feature-orchestrator` skill. Do not implement from chat memory. Read:

1. `AGENTS.md`
2. `plans/post-submit-qualification-builder/decisions.md`
3. `plans/post-submit-qualification-builder/plan.md`
4. `plans/post-submit-qualification-builder/progress.md`
5. `plans/post-submit-qualification-builder/handoff.md`

Important constraints:

- Close CRM credentials are not available. Build with optional env config,
  mocked Close tests, local persistence, retryable sync events, and admin-visible
  failure states. Live Close proof is blocked until credentials and custom-field
  IDs exist.
- Do not push, open PRs, trigger Vercel previews, or run remote DB migrations
  without explicit approval.
- Keep `progress.md` authoritative. Worker reports go in
  `plans/post-submit-qualification-builder/agent-runs/`.
- S1 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S1-attempt-1.md`.
- S2 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S2-attempt-1.md`.
- S3 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S3-attempt-1.md`.
- S4 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S4-attempt-1.md`.
- S5 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S5-attempt-1.md`.
- S6 is complete. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S6-attempt-1.md`.
- S8 page/block attachment code and repo gates are complete, but S8 is blocked
  on browser proof. Evidence is in
  `plans/post-submit-qualification-builder/agent-runs/S8-attempt-1.md`; the
  failed route screenshot is
  `plans/post-submit-qualification-builder/browser-evidence/S8-editor-desktop-initial.png`.
- S8 browser proof tried `/admin/pages/new`, but the local editor route could
  not render: placeholder JWTs failed REST auth, the running `VendPlacement`
  Supabase stack is schema-incompatible, and an isolated temp Supabase stack
  failed migration setup under Supabase CLI 2.75.0.
- Remaining W5 work is S7 admin forms builder plus resolving S8 browser proof.
- Use strict RED -> GREEN -> REFACTOR and record fresh evidence before marking
  any node done.

Begin by reading the files above, confirming the feature state, and reporting
that the next action is either resolving the S8 browser gate or starting S7. Do
not start implementation until the user says to start or continue.
