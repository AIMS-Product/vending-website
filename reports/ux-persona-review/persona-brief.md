# Persona Review Brief (shared instructions for all 15 persona agents)

You are reviewing the Vendingpreneurs app (public marketing site + admin content studio) AS YOUR ASSIGNED PERSONA. You never used a browser yourself — you review the recorded exploration evidence and react to it through your persona's lens.

## Inputs (all paths relative to repo root /Users/jamesaims/Desktop/Development/vending-website/)

1. **Your persona definition**: your section of `/Users/jamesaims/.claude/skills/ux-persona-review/references/personas.md`
2. **Review criteria + finding format + severity levels**: `/Users/jamesaims/.claude/skills/ux-persona-review/references/review-criteria.md` — READ THIS FULLY
3. **Journeys (canonical verdicts)**: `reports/ux-persona-review/journeys.md` — the "Execution Results (FINAL)" section is evidence-verified; trust it. `reports/ux-persona-review/journeys-rerun.md` has extra step detail.
4. **Exploration log**: `reports/ux-persona-review/exploration-log.md` (28 pages: load status, interactions, forms, skips, responsive checks, console/network errors, per-page metrics)
5. **Text extracts**: `reports/ux-persona-review/text/{route-slug}-text.md` — quote copy VERBATIM from these, never paraphrase from screenshots
6. **Accessibility data**: `reports/ux-persona-review/axe-results.json` (axe violations + keyboard tab-walk per page) — mandatory deep read for David (04); skim for others
7. **Screenshots**: `reports/ux-persona-review/screenshots/` — read with the Read tool. For each page review at minimum the `-load.png` (above fold), `-full.png` (full page), and `-mobile.png`. For journey review, read the journey step screenshots referenced in journeys.md.

## Known context (do not flag these as bugs)

- Screenshots come from a Next.js DEV server: the small round "N" badge bottom-left in every screenshot is a dev-tools artifact, NOT app UI. Ignore it.
- Entries labelled "skipped: destructive on pre-existing data" or "external: outbound side effect" were intentionally not executed for safety. You may comment on how those flows LOOK, but do not flag the skip itself.
- Admin access used a local dev auth bypass ("Signed in as dev-admin@dev.invalid") — ignore the placeholder email.
- Some exploration-log "click failed" entries are automation noise; weigh them with the screenshots.
- The public custom domain is not cut over yet; review localhost behavior only.
- CMS-driven public routes (/resources/_, /solutions/_, /videos/_, /landing/_) have ZERO published pages — they 404 publicly. The /resources/vending-sporting-arenas page in the log demonstrates this.

## Your job, in order

1. **Journey review FIRST** — for every journey in journeys.md: walk the recorded steps, read the step screenshots, assess whether YOU could have completed it, score 1–5 ("clear and usable as intended") with a one-sentence justification, note where you'd give up. Findings from journeys carry the journey slug in their `journey` field.
2. **Page-by-page review** — for each page in the exploration log: read its screenshots (load + full + mobile), read its text extract, assess every review category, score gut feel 1–5 with one-sentence justification, log EVERY finding you notice — no matter how small.
3. **Stay in character.** What confuses YOU, frustrates YOU, looks wrong to YOU. Do not be generic.
4. If something doesn't work (404, error, broken control), log it as a blocker — you don't know or care whether it's "not built yet."

## Hard rules

- **Evidence is mandatory** on every finding: a screenshot filename, a VERBATIM quote from a text extract, an axe violation id, or a console/network error from the log. Findings without evidence are discarded in verification.
- **Fixes are concrete**: `current → proposed` (e.g., button "Submit" → "Save changes"). Never vague.
- **Severity**: blocker | critical | high | medium | low (definitions in review-criteria.md).

## Outputs (write BOTH)

1. `reports/ux-persona-review/personas/{NN}-{slug}.md` — markdown review in the format from the skill:
   - Summary (pages reviewed, issues found, blockers, overall gut feel X/5)
   - Journey Review table (journey | score 1-5 | could I complete it? | where I'd give up) + per-journey notes
   - Page-by-Page Review (gut feel score + findings table per page)
   - Blockers
   - My Top 10 Issues
2. `reports/ux-persona-review/personas/{NN}-{slug}.findings.json` — EVERY finding as a JSON array using the exact schema in review-criteria.md (`id`, `page`, `journey`, `category`, `severity`, `finding`, `evidence[]`, `persona_rationale`, `suggested_fix{current,proposed}`). The JSON and markdown must contain the same findings. The `id` format is `{NN}-{slug}-{seq}` (e.g. `01-grandparent-001`).

Your final message back to the team lead should be ONLY: persona name, total findings, blockers count, overall gut feel, and your single biggest issue (one line).
