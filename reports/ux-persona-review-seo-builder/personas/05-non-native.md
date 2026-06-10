# Persona Review — Yuki (Non-Native English Speaker, 31)

I am a Japanese software engineer. I read English well, but I translate in my head.
Idioms, internal-jargon labels, vague status words, and abbreviations slow me down or
stop me. I trust **specific** words and **explicit** formats. When a label is a metaphor
("eyebrow"), an abbreviation with no expansion ("CTA", "301"), or a status word that
could mean several things ("Updating", "Opportunities"), I have to guess — and guessing
in a publishing tool feels dangerous. Dates and timezones matter to me more than to a
native reader, because a wrong reading means I publish at the wrong moment.

Overall this tool is competent and the _help text_ under fields is unusually good for me
(full sentences, no idioms). But the **status/readiness vocabulary** is internal jargon,
the **publish blocker messages contradict each other and hide where the field is**, and
the **scheduling timezone is wrong for an Australian business and gives no confirmation**.

---

## Category 0: Journey Completion

### Journey 1 — create-first-page — Score: 4/5

I could complete this. The 3-step wizard copy is the clearest writing in the whole tool:
"What kind of page are you creating?" and "Choose the page type that best matches your
goal. You can adjust details later in the builder." (`admin-pages-new-text.md`) — full
sentences, no idiom, reassuring. The new canvas placeholders ("Hero headline", "Hero body
copy", "CTA label") are the only friction: "Eyebrow" means nothing to me as a content
label, and "CTA" is never expanded.

### Journey 2 — publish-and-view-live — Score: 2/5

This was the hardest journey for me. The blocker is revealed one word at a time in
internal phrasing, and two different messages describe the same gate at the same moment:
the chip said "Fix SEO title" while the readiness panel said "Add a hero headline before
publishing" (`journeys.md`). Worse, "Fix content 1 · Cta Label" and "Fix content 1 ·
Destination URL" use "content 1" (an internal index, not a name I gave anything) and the
Destination URL field is not on the page — I hunted for it. For a non-native reader,
"Fix content 1 · Cta Label" is almost untranslatable.

### Journey 3 — preview-draft — Score: 4/5

One click, opened a preview tab. "Live preview" is clear. Fine.

### Journey 4 — revision-restore — Score: 3/5

The empty state "Revisions appear after publishing, library refreshes, or draft restores."
(`journeys.md`) is a full sentence I can read, but "library refreshes" and "draft restores"
are noun phrases I had to re-read to parse. The restore itself worked.

### Journey 5 — schedule-publish — Score: 1/5

The field says "Uses Pacific Time (America/Los_Angeles)." For an Australian business this
is the wrong timezone and forces me to do timezone math in my head — exactly the kind of
mental translation that causes mistakes. After I saved, the field re-rendered **empty**
with no "Scheduled for {date}" confirmation anywhere (`journeys.md`). I could not tell if
my schedule was saved. For me, no confirmation = I assume it failed.

### Journey 6 — create-redirect — Score: 3/5

Form copy is okay, but the invalid-submit error is "Path must be root-relative."
(`admin-pages-redirects-011-form-invalid-submit.png`) — "root-relative" is engineer
jargon. I know what it means _because_ I'm an engineer, but the placeholder already shows
`/resources/old-page`, so the message should just say that. Status options expand the
abbreviation well: "Permanent move (301)".

### Journey 7 — find-duplicate-archive — Score: 4/5

Search and the row menu worked. "Archived ... retired" (`admin-pages-text.md`) — "retired"
is a slightly figurative word for a page, but recoverable.

---

## Per-Page Review

### /admin/pages (Pages list) — Gut feel: 3/5

Readable headings, but several filter/status words are internal jargon with no explanation,
and the Readiness column is **color-only** dots with no text in the cell
(`admin-pages-001-load.png`).

### /admin/pages/new (Choice gate) — Gut feel: 5/5

Best copy in the tool. Plain, full-sentence, no idiom.

### /admin/pages/{id} (Editor) — Gut feel: 2/5

Field help text is excellent for me, but block-level labels ("Eyebrow", "CTA label") and
the publish blocker phrasing ("Fix content 1 · Cta Label") are the worst copy in the tool.
Timestamp format is also inconsistent (see findings).

### /admin/pages/redirects — Gut feel: 3/5

Good status-option copy; jargon error message.

### /admin/pages/{id}/revisions/{rid} (Revision preview) — Gut feel: 3/5

"publish - Jun 10, 3:49 PM" (`...revisions...-text.md`) — lowercase bare verb "publish"
as a label reads like a broken string, and the time (PM) disagrees with the editor's "6:19
AM" for what should be the same event.

### /admin/pages/block-preview-audit — Gut feel: 3/5

Clear within itself, but I don't know why I'm here — "Block preview audit" plus "dev QA"
is unexplained internal tooling.

### /resources/... (Published + preview) — Gut feel: 4/5

Public page is clean and readable.

---

## Findings

| #   | Page                       | Journey                | Category         | Finding                                                                                                    | Evidence                                                                                                                                                                                | Severity | Suggested Fix (current → proposed)                                                                                                                                  | Persona Rationale                                                                                                                                                      |
| --- | -------------------------- | ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | editor                     | schedule-publish       | Copy & Labels    | Scheduling uses Pacific Time for an Australian business, forcing timezone math                             | "Uses Pacific Time (America/Los_Angeles). Leave blank unless this page should publish later." (`journey-schedule-publish-05-verify-scheduled.png`)                                      | critical | "Uses Pacific Time (America/Los_Angeles)…" → show the admin's local timezone, e.g. "Uses your local time (Australia/Adelaide). The page will go live at this time." | I already translate language; making me also convert timezones to know when my page publishes is a real risk of publishing at the wrong hour.                          |
| 2   | editor                     | schedule-publish       | Feedback & State | After saving a schedule, the field clears and no "Scheduled for {date}" confirmation appears               | "field shows empty after save, no confirmation" (`journeys.md` schedule-publish)                                                                                                        | high     | After save show explicit text: "Scheduled to publish on Wed 11 Jun 2026, 12:00 (Australia/Adelaide)" near the field                                                 | With no confirmation sentence I cannot tell success from failure; I will assume it failed and try again, risking a double schedule.                                    |
| 3   | editor                     | publish-and-view-live  | Copy & Labels    | Two different messages describe the same publish gate at the same time                                     | Chip "Fix SEO title" vs panel "Add a hero headline before publishing." (`journeys.md` publish-and-view-live)                                                                            | critical | Show one consistent blocker message in both places, listing all gates: "Before publishing: add a hero headline and an SEO title."                                   | Conflicting English sentences make me distrust my own reading and fix the wrong thing first.                                                                           |
| 4   | editor                     | publish-and-view-live  | Copy & Labels    | Blocker text "Fix content 1 · Cta Label" uses an internal index and an unexpanded abbreviation             | "Fix content 1 · Cta Label" / "Fix content 1 · Destination URL" (`journeys.md`)                                                                                                         | high     | "Fix content 1 · Cta Label" → "Add a button label to the Hero section"                                                                                              | "content 1" is not a name I gave anything and "Cta" reads as a typo, not "CTA"; I cannot map this to a field.                                                          |
| 5   | editor                     | publish-and-view-live  | Forms & Input    | Blocker names a "Destination URL" field that is not on the canvas — it is hidden in a block settings modal | "the destination field is NOT on the canvas; it lives in Block actions → Edit settings modal" (`journeys.md`)                                                                           | high     | "Fix content 1 · Destination URL" → "Add a destination URL — open Block actions → Edit settings on the Hero block"                                                  | The message gives no location; without that hint a non-native reader cannot find the field at all.                                                                     |
| 6   | editor                     | —                      | Copy & Labels    | "Eyebrow" is used as a content-field label with no explanation                                             | "Eyebrow" textbox label (`admin-pages-e44f0fc3-...-text.md`, `journey-publish-and-view-live-02-read-publish-blocker.png`)                                                               | medium   | "Eyebrow" → "Overline (small label above the heading)"                                                                                                              | "Eyebrow" is a culturally-specific design metaphor; translated literally it is a body part and meaningless as a field name.                                            |
| 7   | editor / pages list / new  | —                      | Copy & Labels    | "CTA" appears everywhere ("CTA label", "Primary CTA", choice-gate "...and CTA.") but is never expanded     | "CTA LABEL" (`admin-pages-e44f0fc3-...-text.md`), "Article-style page with a strong introduction and CTA." (`admin-pages-new-text.md`)                                                  | medium   | First use → "Call to action (CTA) button" then "CTA" thereafter                                                                                                     | An unexpanded abbreviation forces me to guess; expanding it once removes the guesswork.                                                                                |
| 8   | pages list                 | find-duplicate-archive | Copy & Labels    | Readiness is communicated only by colored dots in the table cell, no text                                  | Readiness column shows only colored dots, no text (`admin-pages-001-load.png`); cell ARIA "SEO readiness: Needs work" exists but is not visible text (`admin-pages-text.md`)            | high     | Add a visible text label beside the dot: yellow dot → "Needs work", red → "Blocked", green → "Ready"                                                                | Color carries different cultural meaning and I cannot read a dot; I need the word printed, not only in a tooltip/aria.                                                 |
| 9   | pages list                 | —                      | Copy & Labels    | Workflow filter labels are ambiguous internal states ("Updating", "Needs links", "Opportunities")          | "All metadata / Needs review / Updating / Needs links / Metadata issues / Scheduled / Schedule failed" (`admin-pages-text.md`); readiness value "Opportunities" (`admin-pages-text.md`) | medium   | "Updating" → "Being edited"; "Needs links" → "Missing internal links"; "Opportunities" → "Could be improved"                                                        | These are one- or two-word internal states; "Updating" could mean the system is busy, and "Opportunities" as a status is a business idiom I cannot map to page health. |
| 10  | redirects                  | create-redirect        | Forms & Input    | Invalid-path error is engineer jargon, not actionable for a normal user                                    | "Path must be root-relative." (`admin-pages-redirects-011-form-invalid-submit.png`)                                                                                                     | high     | "Path must be root-relative." → "The path must start with a slash, like /resources/old-page"                                                                        | "root-relative" is a developer term; I happen to know it, but the message should restate the placeholder example so anyone can fix it.                                 |
| 11  | redirects                  | create-redirect        | Forms & Input    | On invalid submit the entered values are not preserved                                                     | "values preserved: false" (`exploration-log.md` redirects form)                                                                                                                         | medium   | Keep the typed Old path / Destination after a validation error instead of clearing them                                                                             | Re-typing after an error is doubly costly for me because I read and type English slowly; losing my input is punishing.                                                 |
| 12  | editor vs revision preview | revision-restore       | Copy & Labels    | Same publish event shows two different times (AM vs PM) and an inconsistent date format                    | Editor: "Published - Jun 10, 6:19 AM" (`admin-pages-e44f0fc3-...-text.md`); revision page: "publish - Jun 10, 3:49 PM" (`...revisions...-text.md`)                                      | medium   | Use one timestamp format and timezone everywhere, e.g. "Published 10 Jun 2026, 16:19 (Australia/Adelaide)"                                                          | Two different times for one event makes me think I'm looking at different versions; I cannot trust which revision is which.                                            |
| 13  | revision preview           | revision-restore       | Copy & Labels    | Revision label is a bare lowercase verb that reads like an unfinished string                               | "publish - Jun 10, 3:49 PM" (`...revisions...-text.md`)                                                                                                                                 | low      | "publish - Jun 10, 3:49 PM" → "Published on 10 Jun 2026, 3:49 PM"                                                                                                   | A lowercase bare "publish" looks like a code key leaked into the UI; I cannot tell if it's a label or a bug.                                                           |
| 14  | editor                     | revision-restore       | Copy & Labels    | Revisions empty state uses stacked noun-phrase triggers that are hard to parse                             | "Revisions appear after publishing, library refreshes, or draft restores." (`journeys.md` revision-restore)                                                                             | low      | → "A revision is saved each time you publish the page, refresh its content libraries, or restore a draft."                                                          | "library refreshes" and "draft restores" as nouns are ambiguous for a non-native reader; verb-form sentences are clearer.                                              |
| 15  | editor                     | —                      | Copy & Labels    | "Governance comments" and "Builder support" are abstract corporate phrases                                 | "Governance comments" / "Builder support" / "Approved claims and CTAs" (`admin-pages-e44f0fc3-...-text.md`)                                                                             | low      | "Governance comments" → "Internal notes"; "Builder support" → "Content sources"                                                                                     | "Governance" is an abstract business word; "Internal notes" tells me plainly what the box is for.                                                                      |

---

## Summary

The tool is usable and its under-field help text is genuinely good for a non-native
reader. The damage is concentrated in **status/readiness vocabulary** (color-only dots,
ambiguous one-word states), the **publish blocker flow** (contradictory messages, internal
indices like "content 1", a field that isn't where the message points), and **scheduling**
(wrong timezone, no save confirmation, inconsistent date/time formats). These are exactly
the spots where I, translating in my head, would stall or make a publishing mistake.
