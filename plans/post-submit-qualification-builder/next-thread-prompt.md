# Prompt For Fresh Codex Thread

Continue from the completed post-submit qualification builder feature in:

`/Users/jamesaims/Desktop/Development/vending-website-post-submit-qualification`

Use the `feature-orchestrator` skill. Do not rely on chat memory. Read:

1. `AGENTS.md`
2. `plans/post-submit-qualification-builder/decisions.md`
3. `plans/post-submit-qualification-builder/plan.md`
4. `plans/post-submit-qualification-builder/progress.md`
5. `plans/post-submit-qualification-builder/verification.md`
6. `plans/post-submit-qualification-builder/handoff.md`

Current state:

- S1-S12 are DONE locally.
- Final proof is in
  `plans/post-submit-qualification-builder/agent-runs/S12-attempt-1.md`.
- Browser evidence is in
  `plans/post-submit-qualification-builder/browser-evidence/S12-*.png`.
- Live Close proof remains blocked until credentials, custom-field/status IDs,
  and an approved disposable test record exist.

Important constraints:

- Do not push, open PRs, trigger Vercel previews, run remote DB migrations, or
  run live Close writes without explicit approval.
- Keep `progress.md` authoritative if any follow-up work is added.
- Worker reports go in
  `plans/post-submit-qualification-builder/agent-runs/`.
- Custom-domain checks remain post-cutover follow-up until the user says domain
  access has been granted.

Next action:

- If the user provides Close credentials/mappings and approves live proof, run a
  tightly scoped Close proof pass with disposable records and update
  `verification.md`.
- If the user asks to release, follow the repo release-train constraints and do
  not push or open PRs without explicit approval.
