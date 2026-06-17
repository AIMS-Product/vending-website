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
- Next unblocked node is S2: Qualification form schema and services.
- Use strict RED -> GREEN -> REFACTOR and record fresh evidence before marking
  any node done.

Begin by reading the files above, confirming the feature state, and reporting
that the next action is S2. Do not start implementation until the user says to
start or continue.
