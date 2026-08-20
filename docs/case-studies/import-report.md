# Case study import

Mode: dry-run
Rows: 25

Every row is imported as a **draft**. Revenue figures are self-reported
by members and have not been audited — check each story before publishing.

## Needs review before publish

### `andy-consulman` — Andy Consulman

- Name spelling 'Andy Consulman' is a phonetic auto-caption spelling and is not confirmed - verify against the video before publishing.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `anthony-kolodziej` — Anthony Kolodziej

- The transcript's auto-caption misspells his surname as 'Colloj'; corrected to Kolodziej per instruction.
- The transcript itself mis-transcribes the monthly revenue figure as '$12,000' in Anthony's own line, but Mike Hoffman immediately confirms 'you did 102 grand' and the video title states $102K/month, so $102,000 is used as the sourced figure.

### `dj-50k-per-month` — DJ

- Location count stated as 'I want to say it's like 17 or 18' - DJ's own estimate, not exact; low end (17) used per range rule.

### `evan-tomahong` — Evan Tomahong

- Name spelling 'Evan Tomahong' is a phonetic auto-caption spelling and is not confirmed - verify against the video before publishing.

### `graham-and-katie-parker` — Graham and Katie Parker

- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- Specific location types (e.g. apartment, office) were never explicitly named in the transcript beyond 'communities' and 'residents' — left location_types empty rather than guessing.
- Location count (as distinct from machine count) was never stated separately; only machine_count is sourced.
- "About a year" and "in less than a year" timing is approximate per the interview framing, not an exact stated number — months_to_result left null.

### `jason-500-machines` — Jason

- No monthly revenue figure was stated for the current combined business; only 'multi-million dollar route' purchase price and 12-14 pallets/week were given.
- 'North of 500 machines' used as machine_count floor of 500.
- 'A couple hundred accounts... a round number' used as location_count of 200.
- Overall time in business stated loosely as 'two and a half to three years'; left months_to_result null rather than guess a single figure.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `javier-zeder` — Javier Zeder

- machine_count left null: the location is described as one open-market unit, but the transcript never states a distinct machine count.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `jesse-lee` — Jesse Lee

- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- The $7,000/month figure is specifically the purchased route's existing revenue, not Jesse's combined monthly revenue across all locations — monthly_revenue_usd left null since no single 'his revenue' monthly figure was stated.
- Machine vs. location counts are tangled in his own telling ('the drink [route] had 18 locations, but it had a couple... so I'm up to 23') — location_count left null rather than guess how his 3 self-placed locations and the purchased route's locations combine.
- Transcript auto-caption renders 'ChatGPT' phonetically as 'chat GBT' — normalized to the standard spelling; verify against video.
- Video title states this is his 'first 30 days' — used as the elapsed-time stat rather than months_to_result, since he had not yet hit a stated personal revenue result at that point.

### `joe-retiree-route` — Joe

- Body quote 'It wasn't a get-rich scheme...low threshold for investment...' spans a brief interviewer (Anthony) clarifying question ('for someone just starting out...you were working when you first started as well') between the two sentences. Both sentences are Joe's, same topic (why he chose vending), no meaning distortion, but it is not one unbroken utterance - left as-is per conservative policy but flagging for a second look.

### `john-and-lauren-sanchez` — John and Lauren Sanchez

- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- No single stated 'current monthly revenue' figure — only a best-month figure ($14,500 in April) and a per-location average (~$2K) were given, so monthly_revenue_usd is left null per spec (annual/best-month figures go in stats only).
- Exact join date is a hedge from John himself ('maybe August 2024') — not stated as certain.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `john-real-estate-agent` — John

- Surname was spoken phonetically as 'Nukem' in the transcript and video credits but is unconfirmed — per instructions, using only 'John' and not printing that surname.
- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- 'Time to First Location' (~5 months) is calculated from his stated join month (May 2024) and install date (October 15), not a number he stated directly himself.
- This is a different John from john-and-lauren-sanchez.json — same first name, unrelated members.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `kyle-40k-per-month` — Kyle

- Monthly revenue stated as a range ($35-40K); low end used for monthly_revenue_usd per spec.
- Machine count stated as a range (25-30); low end used for machine_count.
- Transcript does not separately state a location count distinct from machine count; left null.
- No specific location types (e.g. office, apartment) were named in the transcript; left empty.
- Annual revenue figure ('not terribly far from half a million') is Kyle's own mental-math estimate, not a firm reported number.

### `lane-200k-per-year` — Lane

- Annual revenue is stated as 'probably in that $200,000-ish a year revenue' - approximate, not exact.
- monthly_revenue_usd left null because only an annual figure was given, per spec rule.
- Body blockquote in 'Where They Are Now' was flagged by fidelity check and rewritten 2026-08-19: original spliced the $4,000/month location detail (from the 'where are you at now' answer) with the 'more time with my son / Henry's Market' line (from a much later 'how has this changed your life' answer) into one quote as if continuous. Replaced with only the verbatim Henry's Market portion, which is genuinely continuous in the transcript.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `madison-6-locations` — Madison

- Revenue is a stated range ($10-12K/month); per spec, monthly_revenue_usd uses the low end (10000) and the full range is shown in stats.
- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- Her market is described only as hot-climate ('it's still hot here'), likely AZ or a similar region — not confirmed, so no location/market claim was added to the body.
- months_to_result (10) is calculated from her own stated start date (January 1) and interview date (November 1st), not a number she stated directly.

### `mallerie-rouch` — Mallerie Rouch

- Name spelling 'Mallerie Rouch' is a phonetic rendering from auto-generated captions and is unconfirmed -- verify before publish.
- months_to_result left null: the transcript gives per-location install months but no single explicit 'X months since joining' statement.
- machine_count left null: only location count (6) is given; the transcript doesn't sum total machines across locations.

### `manuel-duval` — Manuel Duval

- Total machine count across all 10 locations was not stated (only that the best location has 3 machines); left null.
- Time in the program stated only as 'joined October 2024' / '~1.5 years' in the extraction; no exact month count given by Manuel on camera, so months_to_result left null.
- Manuel still works full-time as a detective sergeant; 'prior_occupation' reflects his ongoing career, not a past one, since vending is run alongside it.

### `matt-morrison` — Matt Morrison

- Matt states 'right at about 43,000 a month' directly; a separate predictability comment cites a $42-43K range for the same figure.
- Location count: Matt says he is 'installing our 21st location' with 18-20 coming imminently; 20 used as the most recently confirmed count, with the 21st still in progress.
- Exact months to reach current results not stated (joined April 2024, first location end of June 2024, interview ~March 2026); left null rather than estimate.

### `musa-sadi` — Musa Sadi

- Name spelling 'Musa Sadi' is a phonetic rendering from auto-generated captions and is unconfirmed -- verify before publish.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `sandy-and-joe` — Sandy & Joe

- No steady total monthly revenue figure was given (only the $500-800 normal range for the student machine and the $6-10K band-camp spike); left monthly_revenue_usd null.
- 'One year mark' as of October 30 used for months_to_result (12).

### `shan-25k-per-month` — Shan

- Shan's own occupation/industry before vending was not named in the transcript, only that her role wasn't fully remote after relocating; left prior_occupation null.
- Total machine count for the four locations was not stated; left null.
- 'A year and a half' used as months_to_result (18); not an exact figure Shan herself stated in months.

### `tim-barnes` — Tim Barnes

- The $90K figure is an in-month, on-track projection stated during filming ('we're on track this month to hit 90,000'), not a closed/final month total -- verify before publish.

### `tom-canarino` — Tom Canarino

- Name spelling 'Tom Canarino' is a phonetic rendering from auto-generated captions and is unconfirmed -- verify before publish.
- The $18K/month hotel figure is derived from Tom's stated day-rate range ($500-700/day in the slow season, over 1,000+/day on launch weekends); he never states an $18K monthly total directly -- verify.
- months_to_result and location_count left null: the transcript gives a 60-day timeline for his first locations and roughly a year for the headline hotel deal, but no single overall figure or total location count is stated.
- The closing quote was also the pull quote, so the duplicate blockquote was removed from the story body. Consider adding a different verbatim quote to that section.

### `tyrone-lewis` — Tyrone Lewis

- "Tyrone Lewis" is a phonetic spelling from auto-generated captions and is not confirmed — verify the name spelling before publishing.
- Transcript is auto-generated; verify all dollar figures against the video before publishing.
- "Time to First Location" (4 months) is calculated from his stated join month (August) and first-install month (mid-December), not a number he stated directly himself.
- He mentioned a projected $15,000/month with a new install, but did not give a machine count for this route — machine_count left null.

## All rows

| Slug                      | Member                  | Video         | Monthly revenue | Tags                                                              |
| ------------------------- | ----------------------- | ------------- | --------------- | ----------------------------------------------------------------- |
| `andy-consulman`          | Andy Consulman          | `AqGrp4cw9Is` | $10,000         | career-change, first-location, scaling                            |
| `anthony-kolodziej`       | Anthony Kolodziej       | `fsRX7K_Hg08` | $102,000        | career-change, laid-off, scaling, family-business                 |
| `dj-50k-per-month`        | DJ                      | `6DKjZDolLhk` | $50,000         | career-change, family-business, scaling, route-acquisition        |
| `evan-tomahong`           | Evan Tomahong           | `JKtCeSu6s48` | $7,000          | career-change, no-experience, first-location                      |
| `graham-and-katie-parker` | Graham and Katie Parker | `heSbv_uG734` | $36,000         | couple, family-business, scaling, part-time                       |
| `jason-500-machines`      | Jason                   | `cGoI8lUHhh0` | —               | career-change, scaling, route-acquisition, couple                 |
| `javier-zeder`            | Javier Zeder            | `GO6C25-1mf8` | $8,500          | first-location, part-time, scaling                                |
| `jesse-lee`               | Jesse Lee               | `MmVigkdyzL4` | —               | career-change, route-acquisition, first-location                  |
| `joe-retiree-route`       | Joe                     | `gvvz2nMax0w` | $5,500          | retiree, scaling                                                  |
| `john-and-lauren-sanchez` | John and Lauren Sanchez | `io0UBay3XtU` | —               | couple, family-business, part-time                                |
| `john-real-estate-agent`  | John                    | `E-J7CvK4MNM` | $21,000         | career-change, scaling, first-location                            |
| `kyle-40k-per-month`      | Kyle                    | `HHMaPdTKECs` | $35,000         | laid-off, scaling, part-time                                      |
| `lane-200k-per-year`      | Lane                    | `EyFph0g1z6U` | —               | no-experience, career-change, family-business, part-time, scaling |
| `madison-6-locations`     | Madison                 | `5y5geBPe3mM` | $10,000         | part-time, scaling                                                |
| `mallerie-rouch`          | Mallerie Rouch          | `io1Jkei-yFs` | $4,000          | couple, family-business, part-time                                |
| `manuel-duval`            | Manuel Duval            | `-PO--G7fRq4` | $10,500         | part-time, scaling                                                |
| `matt-dicks`              | Matt Dicks              | `VrZ-d378Ofo` | $20,000         | career-change, family-business, full-time, scaling                |
| `matt-morrison`           | Matt Morrison           | `tfjgFj0BLgI` | $43,000         | part-time, scaling                                                |
| `michael-d-600k-per-year` | Michael D               | `U7KKbZHqBvg` | —               | no-experience, career-change, family-business, scaling            |
| `musa-sadi`               | Musa Sadi               | `kb8ryBm6g9k` | $41,000         | career-change, scaling, route-acquisition                         |
| `sandy-and-joe`           | Sandy & Joe             | `IxLBMQH7iYY` | —               | family-business, part-time                                        |
| `shan-25k-per-month`      | Shan                    | `yP4Y_BBAvq4` | $22,000         | no-experience, scaling, couple                                    |
| `tim-barnes`              | Tim Barnes              | `sGgnnwa2ySs` | $90,000         | scaling, full-time, career-change                                 |
| `tom-canarino`            | Tom Canarino            | `8ih4aTXaot8` | $15,000         | scaling, route-acquisition, part-time                             |
| `tyrone-lewis`            | Tyrone Lewis            | `co01wsvxJw8` | $12,000         | career-change, no-experience, scaling                             |
