# Stack Release Plan

This repo is using a local-only stacked release train for Website Builder / SEO
Page Builder work so completed work can be banked locally and released in
controlled slices.

## Current Baseline

- `main` already contains Website Builder V2 S1-S3.
- S4-S12 and the scheduled publishing runner are held in local stacked branches.
- No stack branch should be pushed, opened as a PR, or deployed to Vercel until
  the user explicitly chooses that slice for release.
- The repo-local Husky `pre-push` guard blocks stack branch pushes by default.

## Current Local Stack

| Order | Branch                                            | Commit     | Purpose                                                                                                     |
| ----- | ------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 0     | `release-stack/builder-v2-00-local-release-guard` | `b1c8729`  | Documents the local-only release train and blocks accidental stack pushes.                                  |
| 1     | `release-stack/builder-v2-01-shared-foundation`   | `affe76d`  | Adds additive builder governance/content/scheduled schema and shared services.                              |
| 2     | `release-stack/builder-v2-02-admin-governance-ui` | `e3a2147`  | Adds governance fields, dashboard filters, author profiles, redirect manager, and scheduled metadata UI.    |
| 3     | `release-stack/builder-v2-03-governance-comments` | `ebf6f31`  | Adds admin-only page/block comments to the editor.                                                          |
| 4     | `release-stack/builder-v2-04-scheduled-runner`    | `d904449`  | Adds protected scheduled publishing cron route, scheduler service, Vercel cron config, and proof artifacts. |
| 5     | `release-stack/builder-v2-05-stack-release-docs`  | see branch | Adds this release playbook and links it from `AGENTS.md`.                                                   |

Each branch is stacked on the previous branch. When these become PRs, each PR
should target the previous stack branch, not all target `main`.

## Why The Stack Is Grouped This Way

The implementation graph had many nodes, but the release stack is grouped around
safe deployment boundaries:

- S1-S3 are already in `main`.
- The additive database foundation must come before admin UI that reads/writes
  those fields.
- Admin governance and management UI can release before any automated scheduler
  runs.
- Comments sit above the shared service foundation and can release separately.
- The scheduled publishing runner is last because it changes passive metadata
  into automated publishing behavior.

The two migration files were already applied during verification, so do not split
or rename them just to make smaller PRs. Keep their filenames and ordering
intact.

## Day-To-Day Rules

- Keep new Website Builder work inside the appropriate local stack branch.
- If the work belongs after the current stack, create a new
  `release-stack/builder-v2-XX-short-name` branch on top of the latest branch.
- If the work belongs inside an earlier slice, decide deliberately whether to add
  a follow-up branch or restack locally. Do not casually rewrite the stack after
  pushing any branch.
- Keep orchestrator evidence in `plans/<feature-slug>/`.
- Do not mix unrelated cutover docs, route-alignment work, UX reports, or temp
  screenshots into stack commits.
- Use `cap` only for local verification and local commits while building the
  stack. Do not let cap push unreleased stack branches.

## How To Add More Banked Work

1. Check the current branch:

   ```bash
   git status --short --branch
   ```

2. Switch to the latest unreleased stack branch:

   ```bash
   git switch release-stack/builder-v2-05-stack-release-docs
   ```

3. Create the next local-only branch:

   ```bash
   git switch -c release-stack/builder-v2-06-short-name
   ```

4. Implement and verify the slice locally.

5. Commit locally with a conventional commit message.

6. Do not push.

## How To Release One Slice

Only do this when the user explicitly chooses a slice to release.

1. Switch to the selected branch.

2. Confirm its parent branch is already pushed or merged as intended.

3. Run the relevant verification for that slice.

4. Push with the explicit release override:

   ```bash
   ALLOW_RELEASE_TRAIN_PUSH=1 git push -u origin HEAD
   ```

5. Open the PR against the previous stack branch.

6. Watch the Vercel preview only after that intentional push.

## Guardrails

- Normal `git push` from `release-stack/*`, `codex/*`, `stack/*`, or
  `builder-v2/*` is blocked by `.husky/pre-push`.
- The push override is intentionally noisy:

  ```bash
  ALLOW_RELEASE_TRAIN_PUSH=1 git push ...
  ```

- Do not bypass with `--no-verify` unless the user explicitly instructs it for a
  selected release slice.
- Do not run Vercel deploy commands for stack branches unless the selected slice
  is being intentionally previewed or released.

## Verification Used For Current Stack Tip

The full current stack tip passed:

```bash
npm run typecheck
npm test -- src/lib/services/seo-pages.test.ts src/lib/page-builder/scheduled-publishing.test.ts src/lib/services/seo-page-scheduler.test.ts src/app/api/admin/scheduled-publishing/run/route.test.ts src/app/admin/pages/actions.test.ts src/lib/admin/list-state.test.ts
npm run lint
npm run build
```

The pre-push guard was also tested directly and blocked `release-stack/*` pushes
by default.

## Current Known Exclusions

The local checkout also has unrelated dirty work that should stay out of the
Website Builder release stack unless the user explicitly changes scope:

- cutover docs and route-alignment files
- public route inventory scripts
- UX persona review reports
- temporary screenshots and audit images
- unrelated lead-attribution and legacy-route changes

Keep those as separate workstreams.
