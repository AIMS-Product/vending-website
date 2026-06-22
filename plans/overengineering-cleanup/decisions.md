# Decisions: overengineering-cleanup

## Confirmed Decisions

- 2026-06-22: Preserve historical orchestrator evidence under `plans/*`.
  Cleanup may add policy or remove clearly stale non-canonical generated outputs,
  but it must not delete feature graph proof that existing release-train rules
  say to keep.
- 2026-06-22: Treat the live AI benchmark harness as stale. The current
  page-builder/SEO provider decision in
  `plans/ai-assistant-seo-review-hardening/decisions.md` makes OpenAI the only
  active provider, so Gemini/Cerebras comparison code and benchmark report
  outputs are not part of the supported runtime.
- 2026-06-22: Keep deterministic AI readiness/fallback behavior out of this
  cleanup. Removing it would change product behavior, not just reduce
  over-engineering.
- 2026-06-22: Keep legacy AI payload normalization that protects against old
  clients or stale records unless a separate release proves the compatibility
  window is closed.
- 2026-06-22: Do not remove Sentry in this pass. The dependency and
  instrumentation are decision-bound until the user confirms whether the Sentry
  project and env vars should be provisioned or removed.

## Safe Defaults

- Prefer deleting one-off abstractions only when existing explicit tables or
  helpers already own the same behavior.
- Keep server action authentication and return contracts at the action boundary
  when extracting shared helpers.
- For admin UI-visible refactors, run rendered-page proof before accepting the
  node.
- Keep the release train local only. Do not push, create PRs, deploy, or trigger
  previews for this cleanup.

## Open Questions

- Should old browser/UX report folders under `reports/` be archived outside the
  repo, or retained as local proof artifacts?
- Should Sentry be fully provisioned or removed from the app?
