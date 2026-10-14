# Next session: finish the Jess handoff (written 2026-10-12 evening)

## Done and live

- vp-webinars #22 + #23: /guide "Start here", runbook + roles owned by Jess (team.json), ads cross-link, polish.
- vending-website #159: /admin/guide "Start here", booked-by-channel below scorecard + KPIs, paid ads card links, Meta campaigns spend/clicks only.
- Handoff guide artifact (private, Adam shares): https://claude.ai/artifact/NVWBNZzvXKeDsraYubZVAV
- Jess = super_admin on website admin already. Webinar board = shared APP_PASSWORD (Adam sends).

## Open, ranked

1. Before the Oct 13 room: webinar Data health failing check "Replay and booking short links are current" (adnb-booking-calendar utm_content=oct06, adnb-replay=sept01). Find where they are set (Bitly / GHL / CNAMEs), fix or hand Adam the exact steps.
2. After the room (Wed Oct 14): confirm the Oct 13 recap, Booked calls and Weekly ad report populate; publish gate green; then refresh the numbers section of the artifact (same file: scratchpad copy is gone, so read the artifact and republish to its URL).
3. Meta "straight to site" campaigns show ~0 Close bookings for 4 weeks while spending (Close funnel "Meta Ads" 0,1,0,0). Read-only: list the leads with Meta UTMs/fbclid in lead_submissions vs their Close funnel; propose a relabel for Dom. No Close writes.
4. Speed: /admin/analytics and /admin/analytics/google-ads stream slowly (Suspense cards). Measure server time per card; cache the slow reads (5-15 min) without changing numbers.
5. Phone check at 390px of both Start here pages, /admin/analytics paid ads card, webinar /ads/winners (Jess may read on her phone).
6. Webinar board auth: one weak shared password (handoff item 6). Propose per-user sign-in (Jess, Ivan, Anthony...) via safe-feature-slice; do not build without Adam's yes.
7. Unverified from the 10-11 handoff: Google Ads keyword/negative changes landed; /contact RSAs (827784799106, 827659269537) approved.
8. Decisions for Adam/Jess (in the guide): Meta "Hammer Them Tuesdays" pause test; Google Consideration +$1,000/mo around Oct 18; Oct 10 changes final read Oct 24; Wednesday replay upload has no owner; Liana's hand-over date.
9. Housekeeping: stale PRs (vp-webinars #6 #7 #21; vending-website #90 #92 #119 #122 + dependabot pile), worktrees ~/vending-website-jess and ~/vp-webinars-jess.

## Rules learned this session

- gh pr merge needs a review first (auto-mode classifier): run a code-reviewer agent, fix findings, then merge.
- Admin visuals: browser-harness on Adam's Chrome (he signs in). Set Page.setWebLifecycleState active or background tabs never finish streaming.
- New read-only admin pages must be listed in viewer-access.ts AND viewer-access.test.ts READ_ONLY_PAGES.
- Roster/owner values are pinned by tests (team.test.ts, checks.test.ts); update them with the roster.

## Session 2026-10-12 late evening (Oct 13 room not started)

1. Short links: PENDING ADAM'S BITLY SIGN-IN (Adam chose: change only the date, keep GHL hosts). Live at 23:50Z:
   adnb-replay utm_content=sept01 (FAIL) · dna-book-your-call sept01_end_cta (FAIL) · adnb-booking-calendar, adnb-sms oct06 ·
   dna-replay, dna-sms-replay oct06_end_cta (pass, stale). Bitly opened at sign-in in Adam's Chrome; nobody signed in within 9 min.
   Steps (app.bitly.com/Bq32henpYEk/links/booking.vendingpreneurs.com/<slug>/edit, destination only): replace the date in
   utm_content with oct13 and keep each link's suffix and anchor: sept01->oct13, sept01_end_cta->oct13_end_cta,
   oct06->oct13, oct06_end_cta->oct13_end_cta. Verify: `python3 automation/preflight.py` in vp-webinars, short-link rows PASS/WARN, no FAIL.
   start-vending.com already on oct13_end_cta.
2. After the room: not started (it is Oct 12). Do Wed Oct 14.
3. Meta "straight to site": DONE, no relabel. After Dom's 10-12 relabel, Close "Meta Ads" first calls per week
   (09-21, 09-28, 10-05, 10-12) = 2, 4, 3, 1 (close_lead_funnel). Only 10 of 644 lead_submissions since 09-07 carry a Meta signal,
   mostly organic IG link-in-bio / setter links; 1 paid Meta ad lead (VP-Masterclass ad -> /contact, not booked). Paid non-webinar
   Meta in the last 28d is "LL - VSL - Leads - ABO" ($281, 28 Meta leads) landing on watch.vendingpreneurs.com (ludicrous.cloud,
   not this site), so those never reach lead_submissions; plus webinar retargeting (Hammer Them $2,362, Replay RT $320).
4. Speed: DONE, PR #160 merged (db6c1136, reviewed by code-reviewer, CI tests pass; npm audit job fails on main too). Root cause:
   channel_daily read in 14 serial 1,000-row pages (3.8 s for 8 weeks). Now readAllPages. fetchFacts output sha identical to main.
   Prod stream /admin/analytics 4.5 s -> 2.7-2.8 s warm (4.0 s first cold hit); google-ads page was already 1.5 s. No cache added.
   Reviewer notes (not fixed): readAllPages can duplicate/drop a row if a write lands mid-read (shared helper, pre-existing);
   no >1,000-row paging test for fetchFacts.
5. Phone 390px: DONE. /admin/guide, /admin/analytics, board /guide, /ads/winners: scrollWidth 390, no element past the edge.
6. Per-user board auth: proposal only (below), not built.
7. Google Ads: RSAs 827784799106 + 827659269537 APPROVED/ELIGIBLE (ad_status sync 10-12 08:19Z). 18:20 PT keyword changes
   not verifiable yet: keyword_daily ends 10-11; recheck after the ~08:00Z 10-13 sync (paused: "vending machine cost" broad,
   [vending machine business near me]; 14 exact added). 39 negatives need an Ads Scripts read (not synced).
   Vending Locations ad 827604660888 now DISAPPROVED, but its ad group was paused 10-11 18:20, so it cannot serve.
8. Decisions: unchanged, still in the guide.
9. Removed worktrees ~/vending-website-jess, ~/vp-webinars-jess (clean, PRs merged). Left open for Adam: vpw #6 #7 (Oct 2),
   #21 (touched 10-12, maybe active); vw #82 #90 #92 #119 #122 and 11 dependabot PRs (#98-#130).

### Item 6 proposal (needs Adam's yes; safe-feature-slice)

Per-user sign-in on the webinar board: reuse the website's Supabase auth (Jess already has an account) or magic links
to an allowlist in team.json; signed, salted session cookie with expiry; APP_PASSWORD kept one week as fallback, then removed.

## Session 2026-10-13 01:30Z (Oct 12 evening PT, room not started)

1. Short links: STILL PENDING. Bitly edit in Adam's Chrome was refused by the auto-mode permission check ("Unrequested Commit
   in a Connected App"); nothing was opened or changed. preflight.py at 01:35Z: 13 pass, 5 warn, 2 fail. FAIL adnb-replay
   (sept01), dna-book-your-call (sept01_end_cta); WARN adnb-booking-calendar, adnb-sms (oct06), dna-replay, dna-sms-replay
   (oct06_end_cta). GHL registrants 505 tagged, Zoom 503 approved, 505/505 in Close. Same edit steps as above; Adam does them
   himself or allows the browser action.
2. After the room: not yet (do Wed Oct 14).
3. Google Ads keyword check: not yet (needs the ~08:00Z Oct 13 sync).
4. Decisions: listed to Adam in chat (unchanged list). vpw #21 updated 10-12 18:44Z, still active: left alone.
5. DONE, PR #161 merged (251b7567, code-reviewer: safe, its MEDIUM fixed). fetchFacts test pages 2,500 channel_daily +
   1,500 lead_submissions rows. npm audit CI on main was ONE advisory, source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q), not the
   dependabot backlog; lockfile bump to 1.2.2, audit job now passes. Gotcha: `npm audit fix --omit=dev` prunes dev deps from
   node_modules; run `npm ci` after.
   Artifact NVWBNZzvXKeDsraYubZVAV: "not found" from this account (.claude-ma); not updated. Republish from the owning account.

## Session 2026-10-13 ~07:00Z (booked-call alignment with Dom; CEO trust)

- Dom's proposal (aims-product.github.io/BTC-Systems/booked-calls-reporting-proposal) mapped in
  `.claude/specs/2026-10-13-booked-calls-alignment.md`. Open questions are Dom's; nothing built that depends on them.
- MERGED vp-webinars #24: Lane 2 credit = Close "Booked By" (blank -> old scraper funnel label; Sales Team Lane never
  read). Board republished 06:12Z on it, gate green. Per-room marketing booked fell (e.g. Aug 18 100 -> 33).
- MERGED vending-website #162: MTD comparison copy; 821 explained (MTD's old Aug archive rule).
- Reconciled by hand: our Close mirror cut to MTD's population = MTD exactly, Oct 1-12: 212 / 126 / 91 / 15 /
  $121,814, every funnel. Rep dashboard same totals. Sales Manager WTD 13/6/4 = ours (its team total is all owners,
  MTD's is roster-only: their own dashboards disagree; tell Dom). Call Capacity = scheduling, not comparable.
- OPEN vending-website #163 (reviewed, CI pending): Company MTD view + "Matches the MTD dashboard" badge on
  /admin/analytics/months, nightly `company-mtd-*` checks, TLG/PPA excluded from all Close booked figures.
  BLOCKED ON MIGRATION: Adam runs in Supabase SQL editor (project aacisvhkmsaabqdvdmmf):
  alter table public.close_lead_funnel add column if not exists lead_owner text,
  add column if not exists business_line text;
  Then: merge #163, trigger /api/admin/close-lead-funnel-sync/run, open /admin/analytics/months, badge = Matches.
  Never merge before the migration: every Close loader selects the new columns.
- Still pending from before: Bitly replay links (6, Adam in Bitly), Google Ads keyword check after 08:00Z sync,
  Oct 13 room results Wed Oct 14.

## Session 2026-10-13 ~08:40Z (account .claude-ma)

1. MERGED #163 (e6bfffb5) after code-reviewer (safe; 4 MEDIUM) + fix commit 236d681f: MTD fetch 5 s timeout, company-mtd
   count checks pass one call of timing (tolerance max(1%, 1/n)), week-view copy + AGENTS.md name the TLG/PPA exclusion.
   Full vitest 4,433 pass, tsc 0, CI 5/5. Not fixed (LOW/judgement): closeUserNames still throws (a /user/ failure fails
   the hourly mirror; same key as search, so rare); company-mtd-\* not in CHECK_COVERS (needs a month-to-date window type).
   Migration was applied. Prod deploy 07:45Z; sync run 07:45Z wrote 8,762 rows; Oct rows: 309/310 have lead_owner.
   /admin/analytics/months badge: "Differs" 227/127/91/15/$121,814 vs MTD 212/126/91/15/$121,814. Reconciled by hand:
   our mirror cut to MTD's roster+exclusions = 212/126/91 through Oct 12 and 227/127/91 through Oct 13, every funnel
   equal (7 "No source" = MTD "Unknown (Needs Review)"). MTD's last build (commit 07:01Z) started before midnight PT,
   so it has not counted the 15 calls scheduled Oct 13. Timing, no code change. Risk: MTD rebuilds irregularly from a
   local machine (gaps up to 4 h overnight); if it has not rebuilt by the 5:30am PT audit, company-mtd-booked fails.
   Fix needs Dom: publish the counted-through date (end_date) in data-YYYY-MM.json; then cut our view to it.
2. Short links: STILL PENDING. Bitly opened in Adam's Chrome 07:39Z, nobody signed in by 08:21Z. preflight 08:22Z:
   13 pass, 5 warn, 2 fail (same 6 links). Six exact destinations are in chat (date -> oct13, suffix/anchor/host kept).
   adnb-sms anchor ends "...OtvXX" (adnb-booking-calendar "...OtvX"): kept as is, maybe a typo.
3. Google Ads (read-only): sync 10-13 08:19Z, keyword_daily now ends 10-12. Paused "vending machine cost" (broad) and
   [vending machine business near me]: no rows on 10-12 (rows 10-09..10-11 only). 14 exact keywords served on 10-12;
   9 first seen after the 18:20 change incl. [vending preneurs] (Brand). Zero-impression keywords write no row.
4. After the room: Wed Oct 14 (not started). Artifact NVWBNZzvXKeDsraYubZVAV still "not found" from .claude-ma.

## Session 2026-10-14 ~05:30Z (Oct 13 night PT, account .claude-ma)

1. MERGED #171 (1202364e) after code-reviewer (safe; 2 MEDIUM, LOWs fixed). Live 05:39Z.
   Cause of the Oct 13 12:30Z `company-mtd-booked` fail (ours 225 vs 212): NOT MTD lag. MTD's 09:26Z
   build already said 225/126/90/15/$121,814 = ours exactly; our fetch (`revalidate: 900`,
   stale-while-revalidate) served a copy from before 07:01Z. Funnel-by-funnel vs MTD 01:40Z build:
   every funnel equal, 231/136/99 (our "No source" 7 = MTD "Unknown (Needs Review)" 7).
   Fix: MTD JSON `no-store`; build time = last GitHub commit to `archives/data-YYYY-MM.json`; over 2 h
   behind our mirror sync -> 5 checks skipped + badge "Not compared: MTD dashboard last rebuilt <time>".
   Chrome 05:40Z: badge reads "Not compared: ... Oct 13, 6:40 PM PT" (ours 10:05 PM PT), numbers equal.
   Open (MEDIUM): (a) MTD commits only when numbers change, so quiet nights may skip the 5:30am check
   and leave Months "Unverified"; watch a week. (b) GitHub unauth API 60/h per IP; a 403 falls back to
   comparing. Swap to the Pages `Last-Modified` header on the JSON itself if (b) bites, or have Dom
   publish `built_at` for (a).
   First audit with the fix: Oct 14 12:30Z. Read `data_audit_runs` company-mtd-\* then.
2. Oct 13 room is in (board read 05:35Z, headless via /api/login): Zoom 598 registered, 125 attended
   (peak 79), 13 booked (12 in room, 1 after; 13/13 in Close), spend $10,375, $798/booked.
   Recap /recap/2026-10-13-06d7993045902fea73e4, Booked calls (13 upcoming) and Weekly ad report
   Oct 13 column all populated. Publish (suite) gate passed 947/947, no open gate issue. Refresh runs
   show "failure" only from site-funnel preflight: 6 short links (Bitly, still Adam), Zoom reminder
   emails off, GHL registrants missing Zoom link. Data health: 1 open problem (short links).
3. MTD scheduled build is broken since 2026-10-09 (Dom). Repo moved stephenolivas/ -> AIMS-Product on 10-09 ~07:00Z;
   cron-job.org dispatches under stephenolivas end in `startup_failure` (63 runs, stopped 22:30Z); Dom-MA-ai dispatches
   ran 07:00-07:30Z only. Since then "Local automation" commits from a laptop, gaps up to 63 h (10-09 20:27 -> 10-12
   18:57). Sim of the new 2 h gate: 6 of the last 6 mornings (10-08..10-13) would skip; 10-01..10-07 all compared.
   Ask Dom: re-point the 15-min dispatcher at AIMS-Product/mtd-funnel-dashboard with his own PAT (or add a `schedule:`).
4. Registrations halved at flat ~$10k/week Meta spend since Sept 29 (cost/reg $10-13 -> $20-22). Cause: the
   "VP Masterclass Webinar | Purchase | CBO | Adv+" campaign (optimizes for Purchase) took ~60% of spend.
   Oct 13 week: Adv+ $5,915 -> 48 GHL regs, 16 attended ($370/attendee); LLA Leads $3,904 -> 510 regs, 83 attended
   ($47). Oct 6: Adv+ $182/attendee vs LLA $42. Adv+ regs attend at 28-33% (LLA 10-20%) and one Sept 29 Adv+ reg
   won $9,000; ad-level booked attribution too sparse to judge. New Adv+ "US - 2" adset 10-13: $3,793, 28,993 clicks,
   22 regs (junk placements). Decision for Adam/Jess; Meta untouched.
5. Oct 13 show rate 20.9% (125/598) = median (range 14.0-28.6% since June; Oct 6 28.6% was the high). The internet
   drop hit at ~minute 35 (77 -> 32 in room by minute 70; Oct 6 still 85) -> 66 at offer vs 92 -> 13 booked vs 42.
6. Oct 20 Zoom webinar 82284428904: start 23:00Z = 6:00 PM CT but /masterclass + confirmation say 7:30 PM CT;
   reminder emails OFF (Oct 13 had type 7). 11 registrants. Owner Jess (run-steps zoom-create). Not changed (Zoom
   edits email registrants): needs Adam's yes. vp-webinars #33 merged (ecd09e29): preflight now FAILs a page/Zoom
   time mismatch (/run's zoom-webinar check compared Zoom to a registry copied from Zoom, so it could never fail).
   Oct 20 GHL tag not set yet (last week set 10-07 04:49Z, right after the room).
7. Handoff artifact NVWBNZzvXKeDsraYubZVAV: still "not found" from .claude-ma; refresh it from the owning account.
