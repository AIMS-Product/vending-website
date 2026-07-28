# Vendingpreneurs — FINAL CLOSE-OUT PROMPT (paste into a fresh session)

Everything below is the complete brief. Do not ask Adam questions mid-run; every
decision you need is already made here. Work top to bottom, then run §7 and
report the checklist verbatim with real pass/fail marks.

---

## 0. Read first, change nothing yet

Repo: `/Users/adamwolfe/vending-website` · branch `main` · Vercel project
`aimanagingservices/vending-website` · live: https://www.vendingpreneurs.com

Read these two, in order, before touching anything:

1. `.claude/specs/2026-07-27-post-cutover-handoff.md` — the cutover itself
2. `.claude/specs/2026-07-28-analytics-and-tracking-handoff.md` — tracking, SMS
   consent, redirects, analytics rebuild. §7 of it is the gotcha list. Obey it.

The site is **live and taking real leads right now**. Production is not a
staging area. Verify on a preview deployment URL before anything reaches
`www.vendingpreneurs.com`.

### Credentials Adam will paste at the top of the session

- **Supabase** access for project `aacisvhkmsaabqdvdmmf` — either a dashboard
  login or the `SUPABASE_SERVICE_ROLE_KEY`. Tasks 1 and 2 are impossible
  without it. If it is missing, say so in one line, **skip tasks 1 and 2, and do
  tasks 3–6 anyway.** Do not stall the whole run on it.
- **Studio**: `adam@modern-amenities.com` / `Idie9epla` (Admin, not Super admin).
  Redact this from every command output with `sed`.
- GA4 / GTM access may not be available. Task 4 has a no-access fallback.

### Absolute rules

- Never touch a Close record whose email is not `@vendingpreneurs-test.com`.
- Never delete a lead row that is not clearly internal/test. Ask instead — and
  if you cannot ask, keep it.
- Do not push to `main` until the full §7 checklist passes on a preview URL.
- Do not weaken or delete a test to make something green.
- No new env vars without telling Adam the exact name and value in the report.

---

## 1. Apply the redirect migration _(needs Supabase)_

`supabase/migrations/20260727220000_relax_redirect_source_to_any_public_path.sql`
is committed but **never applied**. Until it is, a one-segment source like
`/old-offer` fails a database CHECK that demands two path segments — which is
exactly the shape of a retired Webflow URL, so the feature is half-dead.

Apply it against the production database. Then prove it end to end:

1. In Studio → Pages → Redirects, create `/vp-check-oneseg` → `/contact` (301).
2. `curl -sI https://www.vendingpreneurs.com/vp-check-oneseg` must return
   `HTTP/2 301` with `location: /contact`. A 200 or 404 is a failure.
3. Delete the test redirect row afterwards and re-curl to confirm it is gone.

Record the exact curl output in your report.

---

## 2. Set Kody's Studio password to `vending` _(needs Supabase)_

Studio has no set-password-to-a-value function, and Adam's account is `Admin`,
so user management is read-only for him. Set it directly on the Supabase auth
user for Kody's `app_users` row.

Adam has been told `vending` is a 7-character dictionary word on a CMS holding
lead PII. He confirmed anyway. Set it, then **state in the report, in one
sentence, that it is set and should be changed after his first login.**

Verify by signing in at https://www.vendingpreneurs.com/admin with Kody's email
and `vending`, confirming the dashboard renders, then signing out. Do not leave
a session open.

---

## 3. Fix the funnel — it is probably reporting a drop-off that does not exist

**This is the most important engineering task in this document. Do it even if
Supabase access never arrives.**

`/admin/analytics` → Pages & funnel currently reports **43.5% of leads never
start the questions** (23 captured → 13 started), and that number was used to
conclude the first question is the biggest leak on the site.

That conclusion is suspect. `buildFunnel` in
`src/lib/services/admin-analytics-detail.ts` counts _every_ lead in the
"Contact captured" step, including leads submitted on pages that never offer a
qualification flow at all — `/contact`, `/apply`, and the legacy Typeform and
Calendly embed pages under `src/app/[legacyLeadPath]/`. Those leads are
structurally incapable of reaching "Started questions". They are being counted
as abandonment.

Do this:

1. Determine, from the code, which submit paths actually hand off to
   qualification. Start at `src/components/forms/PublicLeadForm.tsx`,
   `src/components/qualification/QualificationRuntime.tsx`, and
   `src/lib/services/qualification-intake.ts`. The signal that decides the
   "Started questions" step today is `latest_qualification_started_at`, written
   in `qualification-intake.ts`.
2. Split the funnel so the qualification steps are measured **only against
   leads that were offered qualification**. Report the non-qualifying leads as
   their own visible number — do not silently drop them, and do not fold them
   into the denominator either.
3. Write the tests first. `admin-analytics-detail.test.ts` already has the
   funnel test pattern; extend it with a case that has both kinds of lead and
   asserts the drop-off percentage is computed against the correct denominator.
4. Re-read the corrected number on production once deployed. **If the true
   first-question drop-off is under ~15%, say so plainly and retract the
   earlier "highest-leverage fix on the site" claim** — Adam has been told the
   old number and will make a product decision on it.

Update §4 of `2026-07-28-analytics-and-tracking-handoff.md` with the corrected
finding.

---

## 4. Confirm GA4 is not double-counting

`src/components/tracking/TrackingScripts.tsx` fires
`gtag('config', 'G-2SX78VE7VF')` directly **and** loads GTM container
`GTM-57QRC275`, which was observed pulling in its own GA4 tag. If both fire,
every pageview is counted twice and all of Kody's reporting is wrong by 2×.

Preferred check: open GA4 realtime and load a production page once; if the
pageview count increments by 2, remove the direct
`gtag('config', GA4_MEASUREMENT_ID)` line and keep the GTM container as the
single source.

**If GA4 access is unavailable** (likely), do this instead — it is conclusive
without a login: load `https://www.vendingpreneurs.com/` in browser-harness,
then read `performance.getEntriesByType('resource')` and count requests to
`google-analytics.com/g/collect` or `analytics.google.com/g/collect` carrying
`tid=G-2SX78VE7VF`. **Two collect hits for the same `tid` on one pageview means
double-counting** — remove the direct `gtag('config', ...)` line for the GA4
property, keep GTM, redeploy, and re-run the same count to prove it is one.

Report the raw count both before and after.

---

## 5. Housekeeping

- `docs/cutover/GO-LIVE-HANDOFF-2026-07-27.md` is untracked and superseded by
  the two specs in §0. Commit it into `docs/cutover/` for the record with a note
  at the top saying it is historical, or delete it — pick one and say which.
- Run `/admin/leads` and confirm no test rows have reappeared since the last
  cleanup. Internal-lead detection lives in
  `src/lib/services/admin-analytics-internal.ts`; if a new test pattern is
  visible in the list, add it there rather than deleting rows by hand.
- Leave `Nathan Wirth · nrwirthdesign@gmail.com` alone. Adam has not ruled on
  whether it is real. Deletion is irreversible; keeping it costs nothing.

---

## 6. Ship

1. `npx vitest run` — all tests green.
2. `npx tsc --noEmit` — clean.
3. `npm run lint` — clean.
4. `npx vercel --archive=tgz` for a preview deploy, run §7 against the preview
   URL first.
5. Only then merge to `main` and let production deploy.
6. `npx vercel ls` to confirm the production deployment is `Ready`.

Commit messages: conventional, no `Co-Authored-By` line.

---

## 7. Self-check — run this at the end and paste the filled-in result

Do not report "done" on anything you have not personally observed the output
of. An unverified item is a FAIL, not a pass.

```
[ ] Redirect migration applied to production DB
[ ] curl of a ONE-segment redirect returns 301 + correct Location   (paste output)
[ ] Test redirect row deleted; re-curl returns non-301
[ ] Kody can sign in to /admin with the new password
[ ] Funnel denominator fixed; new drop-off % is: ____   (old figure was 43.5%)
[ ] Funnel tests added and passing
[ ] Handoff spec §4 updated with the corrected finding
[ ] GA4 collect-hit count per pageview BEFORE: ___  AFTER: ___  (must end at 1)
[ ] vitest: ____ passed, 0 failed
[ ] tsc --noEmit: clean
[ ] lint: clean
[ ] Preview deploy verified before production
[ ] Production deployment Ready
[ ] /admin/analytics loads on production; all four tabs render
[ ] /admin/leads shows no new test rows
[ ] Untracked GO-LIVE doc: committed or deleted (say which)
[ ] Nathan Wirth row still present
```

Then write a short report for Adam in **plain English**: what is now working,
what he needs to tell Kody and Stephen, and anything still open. No phase
numbers, no commit hashes, no internal jargon in the body — technical detail
goes in the spec files.

### Still needs Adam, do not attempt

- Whether `Nathan Wirth` is a real lead.
- Telling Stephen it is safe to delete the five `SK - UTM *` lead fields in
  Close. The site no longer writes them — that is proven — but deleting a Close
  field destroys its history, so anyone reporting on pre-cutover attribution
  should export first.
