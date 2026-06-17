# S9 Attempt 1 - Opt-in Lead Form Public Integration

Date: 2026-06-17
Owner: feature-orchestrator
Status: DONE

## Scope

This pass implemented the public opt-in path for page-builder `lead_form`
blocks. Opted-in forms now render the required short contact fields, submit
through qualification intake, persist local lead/session/sync event state, and
redirect into `/qualify/[token]`. Non-opt-in lead forms keep the legacy
application behavior.

## RED

Expected failing tests were added before implementation:

- `src/app/lead-action-state.test.ts` for action-supplied qualification
  redirects.
- `src/components/forms/PublicLeadForm.test.ts` for the short
  name/email/phone-only qualification form.
- `src/components/sections/ResourcePageRenderer.test.ts` for opt-in,
  non-opt-in, and global-default rendering.
- `src/lib/services/qualification-forms.test.ts` for resolving a selected
  published form to its current immutable version.
- `src/lib/services/qualification-intake.test.ts` for explicit page/block form
  selection.
- `src/app/qualification-intake/actions.test.ts` for public qualification intake
  action success and validation errors.

RED result:

- `npm run test -- src/app/lead-action-state.test.ts src/components/forms/PublicLeadForm.test.ts src/components/sections/ResourcePageRenderer.test.ts src/lib/services/qualification-forms.test.ts src/lib/services/qualification-intake.test.ts src/app/qualification-intake/actions.test.ts`
- Result: failed as expected on missing redirect-state handling, missing
  qualification action module, missing selected-form resolver, legacy-only form
  rendering, and renderer not yet using the qualification path.

## GREEN

Implemented:

- Added `submitQualificationLead` server action.
- Added `redirectHref` support to public lead action state.
- Added `qualification` intent and extra hidden fields to `PublicLeadForm`.
- Kept legacy apply/contact behavior unchanged.
- Added selected published-form resolution and `qualificationFormId` intake
  support.
- Wired public resource lead forms to block/page/global qualification settings.
- Passed global default qualification form ID through the published builder page
  route.

GREEN result:

- `npm run test -- src/app/lead-action-state.test.ts src/components/forms/PublicLeadForm.test.ts src/components/sections/ResourcePageRenderer.test.ts src/lib/page-builder/public-page-route.test.tsx src/lib/services/qualification-forms.test.ts src/lib/services/qualification-intake.test.ts src/app/qualification-intake/actions.test.ts`
- Result: 7 files passed, 42 tests passed.

## REFACTOR / Repo Gate

Refactor stayed narrow: route default-form resolution was moved after the page
existence check so 404 pages do not depend on qualification default lookup.

Commands:

- `npx prettier --write` on touched S9 files and docs.
- `npm run test -- src/app/lead-action-state.test.ts src/components/forms/PublicLeadForm.test.ts src/components/sections/ResourcePageRenderer.test.ts src/lib/page-builder/public-page-route.test.tsx src/lib/services/qualification-forms.test.ts src/lib/services/qualification-intake.test.ts src/app/qualification-intake/actions.test.ts src/lib/page-builder/resource-lead-attribution.test.ts`
- Result: 8 files passed, 47 tests passed.
- `npm run typecheck`
- Result: passed.
- `npm run lint -- <S9 touched files>`
- Result: passed.
- `npx react-doctor@latest --verbose --scope changed --base HEAD`
- Result: no issues found, score 90/100.

The broader `react-doctor --diff` scan against `main` still reports warnings
from earlier feature-branch nodes in `QualificationRuntime` and admin form
components. The S9-only changed-file scan has no React Doctor findings.

## Browser Gate

Status: PASS.

Browser method: Playwright fallback. A direct Browser/IAB control tool was not
available in this turn; Playwright Chromium was used against the real local dev
server.

Environment:

- Dev server: `http://localhost:3002`
- Database: isolated local Supabase stack on alternate ports.
- Seeded disposable page: `/resources/s9-browser-proof`
- Seeded page ID: `77777777-7777-4777-8777-777777777777`
- Qualification form ID:
  `11111111-1111-4111-8111-111111111111`
- No live Close credentials were used.

Screenshots:

- Desktop short form:
  `browser-evidence/S9-public-opt-in-desktop.png`
- Validation errors with typed values preserved:
  `browser-evidence/S9-public-opt-in-validation.png`
- Redirected qualification runtime:
  `browser-evidence/S9-public-opt-in-redirect-qualification.png`
- Mobile short form:
  `browser-evidence/S9-public-opt-in-mobile.png`

Browser assertions:

- Opt-in public page rendered only `Name`, `Email`, and required `Phone`.
- Legacy application qualification fields (`Business stage`, `Available startup
budget`, `Launch timeline`) were absent.
- Hidden qualification metadata included form ID, experiment key, variant key,
  source block ID, and CTA tracking name.
- Invalid submit returned field errors and preserved `Name` and `Email` values.
- Valid submit redirected to `/qualify/[token]`.
- Token route loaded the Typeform-style runtime with `Question 1 of 3`.
- Mobile render showed the same short form without the legacy qualification
  fields.
- No browser console errors were recorded during the proof.

Database assertions from the isolated stack:

- `lead_submissions` stored the submitted contact locally with lifecycle
  `qualification_pending`.
- `qualification_sessions` stored page ID, block ID, experiment key, variant
  key, completion redirect, current question, and linked lead.
- `close_sync_events` stored a pending `lead_create_or_update` event with the
  selected form/version IDs and source attribution.

## Boundary Notes

- No Close credentials were configured.
- No live Close API call was made.
- No remote database migration was run.
- Disposable local data was used for the public page, local lead, session, and
  sync event.

## Recommendation

DONE. Next unblocked node is S11.
