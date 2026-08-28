# Human tags for case studies + wins — DRAFT FOR KODY

Status: **code is built and green; the live data change is NOT applied.**
Date: 2026-08-28

The filter row, the card badges and the article panel are implemented and
tested. They render nothing until the tags reach Supabase, and that write is
held behind your approval of the chips below.

To apply once approved:

    node -r dotenv/config scripts/backfill-case-study-tags.mjs dotenv_config_path=.env.local          # dry run
    node -r dotenv/config scripts/backfill-case-study-tags.mjs --write dotenv_config_path=.env.local

Do NOT use `import-case-studies.mjs --overwrite` for this. It rewrites every
column including `status`, and all 25 rows are published — it would unpublish
the collection.

## Why

The stories lead with revenue. Nobody relates to $40K/mo — they relate to
"physician assistant, two young kids, still working full-time." That detail is
already written in all 25 bodies. It is not filterable and not on the cards.

## What changes

No database migration. `tags` is already `text[]` and already drives the chip
row, the URL, and the facet counts. This is new values in an existing column
plus a second chip row.

Today's row (yours, unchanged): Career Change · Family/Couple · New to Vending ·
Part Time · Full Time · Scaling

Proposed: keep that as row 1, add row 2 = "Who they were before."

---

## Row 2 chips — prior career

| Chip                | Stories |
| ------------------- | ------- |
| Corporate career    | 9       |
| Sales background    | 8       |
| Trades & industrial | 3       |
| Food & hospitality  | 3       |
| Finance & banking   | 3       |
| Real estate         | 3       |
| Tech                | 2       |
| Fitness & training  | 2       |
| Police & military   | 2       |
| Healthcare          | 1       |

Healthcare is 1 story (Mallorie). Keeping it anyway: "full-time clinician, two
kids, no time" is the most repeatable objection we have. Cut it if you'd rather
not run a chip that returns one result.

Dropped at n=1: retail, legal, marketing, manufacturing.

## Row 3 chips — how they built it (recommend as a filter, or as card badges only)

**Employment status while building**

| Chip                           | Stories |
| ------------------------------ | ------- |
| Kept the day job               | 9       |
| Already self-employed          | 5       |
| Between jobs when they started | 5       |
| Quit to go all in              | 4       |
| Stay-at-home parent            | 3       |

**Who they built it with**

| Chip                             | Stories |
| -------------------------------- | ------- |
| Built it solo                    | 13      |
| Built it with their spouse       | 6       |
| Built it with their kids         | 5       |
| Built it with a business partner | 2       |

`Built it with a business partner` fills a real gap — Andy (Keith) and Tim (Ben)
are partner stories that `Couple` and `Family/Couple` both misdescribe today.

**Life situation**

| Chip                               | Stories                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| Raising kids while building        | 10                                                       |
| Burned out on the grind            | 6                                                        |
| Came back from a failed business   | 6                                                        |
| Money was tight                    | 6                                                        |
| Hedging against layoffs / AI       | 4                                                        |
| Started after a cross-country move | 3                                                        |
| Started in their 50s or 60s        | 2                                                        |
| Sole breadwinner                   | 2                                                        |
| Just out of college                | 1 (Javier — the only story that speaks to a 22-year-old) |
| Started on parental leave          | 1 (Matt Morrison)                                        |

That's 24 chips total across three rows, which is too many to show at once.
**Built as: rows 1 and 2 are filters; the row-3 values render as badges on the
card and the article instead of as chips.** They're better at making a person
feel real than at narrowing a list. Cards show the two highest-priority badges,
the article shows all of them in a "Who they are" panel above "Their route".

---

## Deliberately NOT proposed

Evidenced in the bodies, wrong to make into a clickable filter:

- **Bereavement** — Musa lost his mother and brother in 2025. Central to his
  story. Not a chip.
- **Special-needs child** — Matt Dicks and Sandy. Let the stories say it; don't
  index people by it.
- **Bankruptcy** as a personal label — DJ and Jesse. `Came back from a failed
business` covers it without the word.

Flagging these so the decision is yours and on the record, not mine and silent.

---

## Separate issue: four live stories are tagged wrong

These are published right now and the tag is not supported by the body.

| Story   | Tag                 | Problem                                                                |
| ------- | ------------------- | ---------------------------------------------------------------------- |
| DJ      | `route-acquisition` | No route was bought. He installed 4 → 33 machines.                     |
| Musa    | `route-acquisition` | No acquisition anywhere. He placed locations organically.              |
| Anthony | `family-business`   | Nobody in his family works the business. Only staff is an ops manager. |
| Javier  | `scaling`           | One location, one month in. It's a first-location story.               |

Misleading but defensible:

| Story              | Issue                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| John (real estate) | Tagged `career-change`, but he's still an agent — "supplement my income." Should be `part-time`.                        |
| DJ                 | Missing `part-time` — still earning from the mortgage business.                                                         |
| Andy, Thyrone      | Both went full-time; neither is tagged `full-time`.                                                                     |
| Kyle               | Tagged `part-time`, but he has no day job — he works 15-20h/wk by choice. Different meaning than the other part-timers. |
| Tom                | `route-acquisition` — taking over abandoned machines is location takeover, not buying a route.                          |
| Shan               | `couple` is thin. She's the operator; husband appears once.                                                             |

Worth fixing in the same pass.

## Also: four member names are misspelled on live pages

Slug vs. actual name: `andy-consulman`/Kunselman, `mallerie-rouch`/Mallorie
Rauch, `tom-canarino`/Tom Canterino, `tyrone-lewis`/Thyrone Lewis. These are
auto-caption spellings already flagged in each file's own review notes. Slugs
are load-bearing for SEO — changing them needs redirects, so this is a separate
decision, but the display names should be right.

---

## One gap worth sourcing for

Only **one** of the 25 stories is someone who already ran their own vending
route before joining. DJ had four machines through Naturals2Go from April 2024,
met Mike at a Wealth Without Wall Street conference that August, and was at 33
machines and ~$50K/mo by December 2025.

That is the highest-intent audience there is — an operator who already believes
in vending and only needs to believe in VP. One proof point is thin. Worth
asking the team to source two or three more.

## Wins site (wins.vendingpreneurs.com)

Not covered by this draft. The wins corpus has no human data to surface: of 274
wins, 2% mention a spouse, 1% mention a day job, 40 are posted as "Member" with
no name, and **not one of the 114 authors has a surname**. The automatic join
from a case-study person to a wins member returns 0 of 25.

So wins needs profiles authored per person, keyed by member ID. Separate
decision — see Adam.
