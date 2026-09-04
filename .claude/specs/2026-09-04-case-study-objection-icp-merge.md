# Case studies: objection + ICP merge from the Objection Library

Date: 2026-09-04 · Branch: `feat/case-study-objection-icp-facets`

## What this did

The Objection Library (`objection-library.vercel.app`) is a separate Supabase
project where the sales team hand-tagged 24 member videos with the objections
each one answers and the ICP the member belongs to. 23 of those 24 videos are
the same people as our written case studies.

Those tags are now inherited by the case studies, joined on YouTube video id,
and drive three new filter rows on `/case-studies`. Nothing was re-derived that
the library already knew.

`scripts/merge-objection-library-tags.mjs` does the join. It is add-only and
re-runnable: it never removes a tag and never writes any other column, so an
editor's work in `/admin` survives a re-run.

## The index: 2 visible rows, not 6

A first pass rendered all six axes as open rows — 51 chips and roughly 918px
of filter above the first story. That is a wall, not a filter. It also shipped
the same idea twice: measured against the real stories,

| Overlap      | Chips                                          | Verdict             |
| ------------ | ---------------------------------------------- | ------------------- |
| Jaccard 1.00 | Blue Collar / Trades & Industrial              | identical 3 stories |
| Jaccard 1.00 | Military & Law Enforcement / Police & Military | identical 2 stories |
| Jaccard 0.73 | Leaving a W-2 / Corporate                      | 8 of 11 shared      |

So the three "people" rows collapsed into one. Each chip in `WHO_TAG_GROUPS`
now collects every tag that means the same thing, whatever vocabulary it
arrived in — the library's ICP names, our `from-*` career tags, and the older
situation tags.

Four chips were deleted rather than merged: `scaling` (19 of 25 stories),
`career-change` (15), `part-time` (11) and `first-location`/`no-experience`
(11). A chip that keeps three quarters of the set does not narrow anything.

Final shape — 294px collapsed:

|                       | Row                      | Chips |
| --------------------- | ------------------------ | ----- |
| visible               | What's holding you back  | 9     |
| visible               | Who they are             | 12    |
| behind "More filters" | The job they left        | 7     |
| behind "More filters" | What they make           | 4     |
| behind "More filters" | Where their machines are | 10    |

The disclosure is a native `<details>`, so the page still ships no JavaScript
for filtering and every chip is still a crawlable link. It opens automatically
when one of its own filters is active, so a shared `?career=healthcare` link
does not look like it filtered nothing.

The revenue row is not new code. `buildRevenueFacets` was already written,
tested and wired into filtering, but `page.tsx` never called it, so
`?revenue=25k-50k` worked only if you typed it by hand.

`location_types` is free text and had arrived with 23 spellings for 10 real
places (`apartment`/`apartments`, `gym`/`fitness center`, `government
facility`/`government-building`). These are normalised on read, not rewritten
in storage, so the members' own wording still shows on their article page.
Matching is on the whole normalised value, never a substring, so `office` does
not swallow `dental office`. All 23 values map; nothing falls through.

## Verification

- `vitest run` — 248 files, 1987 tests, green
- `tsc --noEmit` — clean
- `eslint` — clean
- `npm run build` — passes
- Rendered against a real server, after a clean `.next` rebuild: 2 rows
  visible, 3 behind the disclosure, and every count matches the database —
  price 7, women 3, blue collar 3, military 2, leaving-W-2 11 (the union of
  10 and 9 sharing 8), healthcare 1, price+women 0 (rows intersect, not union)

## Needs your call

### 1. Musa Sadi has no ICP

The library gave him `Timing` but left ICP empty, and his case study lists
`prior_occupation: "Hospitality manager"` — which could read as Blue Collar or
as Leaving Corp America / W-2. I did not guess. He is the one published story
with no ICP tag and will not appear in any "Who they are" chip until someone
picks one.

### 2. Eleven member names disagree across the two systems

Several stories disagree with _themselves_ — the slug and the displayed name
are different people's spellings. Tom's own `review_notes` already flags his
name as an unconfirmed phonetic rendering from auto-generated captions, so this
is a known problem that was never resolved.

| Displayed name | Slug says          | Library says      | Note                          |
| -------------- | ------------------ | ----------------- | ----------------------------- |
| Tom Canterino  | tom-**canarino**   | Tom               | flagged in review_notes       |
| Mallorie Rauch | **mallerie-rouch** | Mallorie          |                               |
| Thyrone Lewis  | **tyrone**-lewis   | Thyrone           |                               |
| Andy Kunselman | andy-**consulman** | Andy              |                               |
| Musa Sadi      | musa-sadi          | **Moosa Saidy**   | both look caption-derived     |
| Michael D      | michael-d          | **Michael Deese** | library has a surname we lack |
| Manuel Duval   | manuel-duval       | **Manuelle**      |                               |

I changed no names. These are real members on a public page and the right
spelling is not knowable from the data — it needs someone who has met them.
Slugs must not change regardless: the published URLs would break.

### 3. One library video has no case study

`An Honest Conversation on Vending with Mike and Chelsea Hoffman` is the only
library video with no written story, and its notes field is 28 characters. It
needs a transcript to become a case study. Left as a library-only video.

### 4. Two case studies are missing from the library

`john-and-lauren-sanchez` and `john-real-estate-agent` have YouTube videos but
no library row, so they were hand-tagged here from their own body copy
(evidence quotes are in `MANUAL_TAGS` in the merge script). Adding them to the
library would make both systems agree — two inserts, not done here because the
library is a different project.

## Full tag assignment

Two stories are hand-tagged; the other 23 are inherited verbatim.

| Story                   | Source          | Objections                                | ICPs                                          |
| ----------------------- | --------------- | ----------------------------------------- | --------------------------------------------- |
| andy-consulman          | library         | Price, Spouse, Status Quo, Trust          | entrepreneur, leaving-w2                      |
| anthony-kolodziej       | library         | Implementation, ROI, Spouse, Price, Trust | leaving-w2, laid-off                          |
| dj-50k-per-month        | library         | DIY, Price, Spouse                        | laid-off, entrepreneur                        |
| evan-tomahong           | library         | Need/Fit, Status Quo                      | leaving-w2, young-professional                |
| graham-and-katie-parker | library         | Trust, Implementation, Price, Spouse      | family-biz, leaving-w2                        |
| jason-500-machines      | library         | Spouse, Status Quo                        | leaving-w2, entrepreneur                      |
| javier-zeder            | library         | Need/Fit                                  | young-professional, entrepreneur              |
| jesse-lee               | library         | Price, Implementation                     | blue-collar                                   |
| joe-retiree-route       | library         | Implementation                            | retired                                       |
| john-and-lauren-sanchez | **hand-tagged** | Spouse, Timing, Implementation            | family-biz, entrepreneur, stay-at-home-parent |
| john-real-estate-agent  | **hand-tagged** | ROI, Timing, Implementation               | investor, entrepreneur                        |
| kyle-40k-per-month      | library         | Price, Spouse, Implementation             | leaving-w2, serial-entrepreneur               |
| lane-200k-per-year      | library         | Need/Fit                                  | blue-collar                                   |
| madison-6-locations     | library         | Implementation, Spouse                    | stay-at-home-parent, female                   |
| mallerie-rouch          | library         | Status Quo, Implementation, Timing        | female                                        |
| manuel-duval            | library         | DIY, ROI, Status Quo, Implementation      | investor, military                            |
| matt-dicks              | library         | Timing, Need/Fit, Spouse                  | leaving-w2                                    |
| matt-morrison           | library         | Price, Timing, Implementation             | leaving-w2                                    |
| michael-d-600k-per-year | library         | Status Quo, Trust                         | blue-collar, entrepreneur, military           |
| musa-sadi               | library         | Timing                                    | **none**                                      |
| sandy-and-joe           | library         | Need/Fit, Timing                          | family-biz                                    |
| shan-25k-per-month      | library         | Need/Fit                                  | female                                        |
| tim-barnes              | library         | Trust, Timing, Need/Fit, Implementation   | leaving-w2                                    |
| tom-canarino            | library         | Implementation, Timing                    | serial-entrepreneur                           |
| tyrone-lewis            | library         | Implementation, DIY, Timing               | leaving-w2                                    |

`Contract / Legal` is the one library objection no story earned. Its chip is
hidden rather than rendering an empty result, and it returns automatically the
first time a story earns it.
