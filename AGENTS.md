<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:domain-cutover-rules -->

# Custom domain cutover status

CUT OVER 2026-07-27. `vendingpreneurs.com` and `www.vendingpreneurs.com` resolve
through Vercel (apex + www A records at `76.76.21.21`) and serve this app. The
Webflow rollback proxy that previously answered on those hosts (identified by the
`x-vp-rollback-origin: webflow` response header) has been replaced.

Public-domain behavior is now app behavior: treat a wrong response on
`www.vendingpreneurs.com` as a real bug, not as legacy Webflow noise.

Rollback path if production must be reverted: re-promote the last rollback-proxy
production deployment. DNS does not change in either direction.

<!-- END:domain-cutover-rules -->

<!-- BEGIN:production-deploy-rules -->

# Production deploys

Production is live. Pushes to `main` publish to the custom domains.

- `main` is the release branch; deploy by merging into it, never by
  `vercel --prod` from a working tree.
- Verify a deployment on its own `*.vercel.app` URL before promoting anything to
  the custom domains.
- Leads flow to Close CRM from production on a 10-minute cron. Changes to
  `src/lib/close/*` or the qualification intake path are customer-visible the
  moment they deploy — verify on preview against the real Close org first.

<!-- END:production-deploy-rules -->

<!-- BEGIN:admin-studio-design-rules -->

# Admin Studio and SEO Page Builder design contracts

Before changing `/admin` CMS UI, SEO Page Builder UI, editor controls, block editing, visual polish, or browser-facing admin workflows, read:

- `docs/design/admin-studio.md`
- `docs/design/page-builder.md`
- `docs/design/page-builder-blocks.md`
- `docs/design/visual-review-checklist.md`

These are execution contracts, not inspiration docs. Do not introduce UI that violates them without updating the relevant design contract in the same change.

The active product roadmap remains `docs/seo-page-builder/roadmap.md`; the design docs define how the admin/editor experience should be implemented and verified.

<!-- END:admin-studio-design-rules -->

<!-- BEGIN:feature-orchestrator-rules -->

# Feature Orchestrator flow

When work is being executed from a tracked feature graph under `plans/<feature-slug>/`,
keep the canonical workflow inside the `feature-orchestrator` skill. Use stage
skills only as explicit orchestrator stages, such as `feature-slice-worker`,
`feature-integrator`, or `feature-proof`, and do not switch to a standalone
implementation skill as the primary workflow for a graph node.

The orchestrator owns `plan.md` and `progress.md`. Worker evidence belongs under
`plans/<feature-slug>/agent-runs/` and should be integrated back into
`progress.md` only by the orchestrator stage.

<!-- END:feature-orchestrator-rules -->

<!-- BEGIN:builder-release-train-rules -->

# Website Builder release train

For Website Builder / SEO Page Builder work tracked under
`plans/website-builder-feedback-v2/` and follow-up graphs, use a local-only
stacked release train until the user explicitly asks to push a branch or create
a PR.

Use `docs/stack-release.md` as the release-train playbook.

Current release baseline:

- S1-S3 are already landed on `main`.
- S4-S12 and follow-up scheduled publishing runner work should be split from the
  dirty working tree into dependency-ordered local branches/commits.
- Do not push these branches, open PRs, or trigger Vercel previews until the user
  explicitly chooses the next slice to release.

When continuing this work:

- Add new changes to the appropriate local stack branch, or create a new branch
  on top of the latest unreleased stack branch when the work is a later slice.
- Keep branches stacked in dependency order so each future PR can target the
  previous slice branch rather than all PRs targeting `main`.
- Preserve orchestrator evidence in the relevant `plans/<feature-slug>/`
  folder, but avoid mixing unrelated cutover/docs/report/tmp artifacts into
  release-train commits.
- When using `cap` for this release train, run it as a local commit/verification
  flow only. Do not use the default cap push/deploy path for unreleased stack
  branches.
- Treat any push, PR creation, Vercel preview, or production release as an
  explicit user-controlled step, not part of ordinary implementation.
- The repo-local Husky `pre-push` guard blocks stack branch pushes by default.
  Only bypass it for the user-selected release slice with
  `ALLOW_RELEASE_TRAIN_PUSH=1`.

<!-- END:builder-release-train-rules -->
