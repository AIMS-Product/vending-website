/**
 * Every change made in the Google Ads account (755-564-3511), with the
 * evidence behind it. Rendered on /admin/analytics/google-ads. Append a row in
 * the same PR as any account change; never edit an old one.
 */
export type GoogleAdsChange = {
  /** Pacific time, as the account reports it. */
  at: string;
  kind: "ads" | "negatives" | "keywords" | "bidding" | "tracking" | "campaigns";
  entity: string;
  before: string;
  after: string;
  evidence: string;
  expected: string;
};

/** The day Google started bidding toward booked calls; the frozen baseline ends the day before. */
export const CHANGE_DATE = "2026-10-10";

export const GOOGLE_ADS_CHANGES: readonly GoogleAdsChange[] = [
  {
    at: "2026-10-10",
    kind: "bidding",
    entity: "Goals and VP | Brand",
    before:
      "Page views counted as conversions; Brand on its old strategy; Web Retargeting on",
    after:
      "Junk goals off; CRM - Booked Call (primary) fed daily; Brand on Maximize conversions; Web Retargeting paused; utm_term on every click",
    evidence:
      "Retargeting $1,661 / 90d for 0 booked calls; 1,554 page-view 'conversions' in 30d steering bids",
    expected: "Google learns from booked calls instead of page views",
  },
  {
    at: "2026-10-11 01:47",
    kind: "ads",
    entity:
      "8 new responsive search ads, one per enabled ad group (6 in W2, 2 in Brand)",
    before:
      'Every enabled ad group\'s only live ad was "Disapproved: unreliable claims" ("850+ operators", "$3M+ in sales", "first machine in 90 days", "$5K/mo")',
    after:
      "Claim-free ads (no counts, dollar figures, income or timeframes), same landing pages; the 8 disapproved ads paused, kept for history",
    evidence:
      "Ad policy read 01:43: 8 of 8 live ads disapproved; W2 impressions fell 44% on 10-10 (953 to 536); Brand 0 impressions since 09-16",
    expected: "W2 and Brand serve again once Google approves the new ads",
  },
  {
    at: "2026-10-11 01:58",
    kind: "negatives",
    entity:
      'Shared negative list "Wasted intent 2026-10 (media buyer)" on W2 and Brand',
    before: "11 shared lists, 180 negatives",
    after:
      "+15 phrase negatives: free vending machine, full service vending, vending machine companies near me, for my business, northwest vending, canteen vending, haha vending, gbvending, make money online, online franchise, side hustles, ways to make money, from home, jobs, bulk candy",
    evidence:
      "Search terms with spend and no form fill, booking or CRM upload in 90 days; none blocks a live keyword or a term that ever converted",
    expected: "About $550 per 90 days of wrong-intent clicks removed",
  },
  {
    at: "2026-10-11 01:58",
    kind: "negatives",
    entity: "VP | Brand campaign negatives",
    before: "Brand keywords matched generic machine searches",
    after:
      "+7 phrase negatives: ai vending machine, smart vending, digital vending machine, 24 hour smart, 24hr smart, how to get into the vending machine business, buying a vending machine",
    evidence: '"ai vending machine" $115, 31 clicks, 0 leads inside Brand',
    expected: "Brand budget stays on brand searches ($27 per booked call)",
  },
  {
    at: "2026-10-11 01:58",
    kind: "keywords",
    entity:
      'Brand > Vending Locations: "vending machine business location" (broad)',
    before: "Enabled",
    after: "Paused (phrase version left on)",
    evidence:
      "$4,577 in 90 days for 3 booked calls: $1,526 per booked call, 10x the account's $149",
    expected: "A non-brand keyword stops taking Brand's $50 a day",
  },
  {
    at: "2026-10-11 01:58",
    kind: "keywords",
    entity: "5 exact keywords from converting search terms",
    before: "Search terms only",
    after:
      "W2 Research General: [how to get into vending machine business], [how to get into the vending machine business], [how do i start a vending machine business], [starting a vending machine business 2026]; Brand: [vending accelerator]",
    evidence:
      "2-3 form fills each in 90 days; two booked a call; [vending accelerator] booked on $14",
    expected: "Control and ad relevance on queries that already convert",
  },
  {
    at: "2026-10-11 02:14",
    kind: "ads",
    entity: "4 new sitelinks on W2 and Brand",
    before:
      '5 of 6 sitelinks disapproved: 3 for claims ("Over 1,000 active members", startup-cost promises), 2 pointing at dead pages (/build-your-vending-business is a 404, the beginners article redirects)',
    after:
      "Book a Strategy Call (/book-your-call), Vending Startup Questions, Member Case Studies (/case-studies), Contact Our Team (/contact); claim-free, every page answers 200. Old ones left linked (they cannot serve)",
    evidence:
      "Asset policy read 02:10; W2 loses 64% of impressions to ad rank, and sitelinks feed ad rank",
    expected:
      "Sitelinks show again: bigger ads, better click-through and ad rank",
  },
  {
    at: "2026-10-11 10:57",
    kind: "ads",
    entity:
      "4 new RSAs landing on /contact: W2 Research General (827756722925), Cost Research (827756630879), Profit Research (827756706470), Buy/Acquire (827756706479)",
    before:
      "Last night's claim-free RSAs in these 4 ad groups (827730530582, 827604665514, 827604644322, 827604686595) disapproved again for unreliable claims; they land on the homepage",
    after:
      "Same claim-free copy, final URL /contact; the 4 disapproved RSAs paused. The 3 approved-limited homepage ads and both Brand ads unchanged",
    evidence:
      'Policy read 10:54: every RSA landing on / was flagged (4 disapproved, 3 limited); the only clean approval lands on /contact. Homepage text has "$90K/Month", "2-15 days to place your first machine", "guarantee consistent income", "passive income" and no earnings disclaimer; /contact has the disclaimer. Homepage CTAs already link to /contact',
    expected:
      "The 4 W2 ad groups serve again once approved; same lead form, one step shorter",
  },
  {
    at: "2026-10-11 11:03",
    kind: "ads",
    entity:
      "5 disapproved sitelinks unlinked from W2 and Brand (341871490082, 341871490091, 352563868973, 358106694179, 358106694182)",
    before:
      "Linked but not eligible (3 misleading claims, 2 dead destinations)",
    after:
      "Unlinked (assets kept). W2 and Brand each show 5 approved sitelinks: the 4 new ones plus Free Resources",
    evidence:
      "All 4 new sitelinks APPROVED / ELIGIBLE on both campaigns at 10:54; read-only check after the run shows no disapproved sitelink linked",
    expected: "Tidy only; disapproved sitelinks could not serve",
  },
  {
    at: "2026-10-11 18:20",
    kind: "ads",
    entity:
      "Start Action (827784799106) and License & Finance (827659269537): same claim-free RSA copy, final URL /contact",
    before:
      "Only live ads (827646533665, 827604655572) landed on / and were Approved (limited): unreliable claims",
    after:
      "New /contact RSAs under review; the two limited homepage RSAs paused. Landing pages untouched (figures are CEO-approved)",
    evidence:
      "Audit 2026-10-11 row 1: the 4 ad groups moved to /contact on day 2 came back APPROVED; Start Action books at $75 per booked call (30d)",
    expected: "Both ad groups fully eligible again: about +1-2 booked/mo",
  },
  {
    at: "2026-10-11 18:20",
    kind: "campaigns",
    entity: "VP | Brand > Vending Locations ad group (199840060207)",
    before: "Enabled; non-brand group, its only ad disapproved",
    after: "Paused",
    evidence:
      "Audit row 4: broad keyword paused on day 1, phrase last spent 09-09, ad 827604660888 DISAPPROVED",
    expected: "Brand's $50/day stays on brand searches ($56 per booked call)",
  },
  {
    at: "2026-10-11 18:20",
    kind: "keywords",
    entity:
      'Paused "vending machine cost" (broad, Cost Research) and [vending machine business near me] (License & Finance); added 14 exact keywords from converting search terms (13 in W2, [vending preneurs] in Brand)',
    before:
      "$324 and $203 per 30d with 2 and 0 booked; converting terms matched only loosely",
    after: "Two keywords paused; 14 exact keywords enabled",
    evidence:
      "Audit rows 2, 3, 7 (90d/30d keyword and search-term data); every added term produced a Google-attributed booked call",
    expected: "About $850/mo moves to cheaper keywords: +3-5 booked/mo",
  },
  {
    at: "2026-10-11 18:20",
    kind: "negatives",
    entity: 'Shared list "Wasted intent 2026-10 (media buyer)": +39 negatives',
    before:
      "Wrong-intent terms (rentals, single-machine prices, hardware, other brands) matching",
    after:
      "39 phrase/exact negatives, incl. VendHub/VendScout brand terms (approved)",
    evidence:
      "Audit section 3: $958.81 / 90d, $134.77 / 30d; checked against all 310 converting terms and live keywords, 0 conflicts",
    expected: "Small: at most +1 booked/mo",
  },
  {
    at: "2026-10-27 17:48",
    kind: "keywords",
    entity:
      "VP | Brand: every broad brand keyword paused (vendingpreneurs, vendingpreneurs cost, vendingpreneur, vendingpreneurs reviews, mike hoffman vending, mike hoffman vending machine, mike hoffman official, mike vending machine); added [vendingpreneurs] and phrase vending preneurs, vendpreneur, vendingpreneur, mike hoffman vending, mr passive",
    before:
      "Broad brand keywords live; 40% of Brand search-term spend ($570 of $1,434, 90d) went to non-brand searches (vending machine, vendvice, turnkey business meaning)",
    after:
      "Brand runs on phrase and exact only; [vending preneurs] and phrase vendingpreneurs / vendingpreneurs cost unchanged",
    evidence:
      "Jess's brand recommendation (2026-10-27); broad vendingpreneurs cost $419 / 90d was the largest leak; one-off script 12615075, 29 changes, all successful",
    expected:
      "Brand spend stays on brand searches; cost per booked call falls toward its $27-56 history",
  },
  {
    at: "2026-10-27 17:46",
    kind: "keywords",
    entity:
      "VP | W2 | Consideration: paused buying vending machine business (broad), license for vending machine business (broad), new vending machine cost (broad), starting a vending machine side hustle (broad), [vending machines for sale]; added 11 phrase/exact keywords across Start Action, Research General, Buy/Acquire and Cost Research",
    before:
      "Broad keywords at $705, $454 and $246 / 90d for 1, 0 and 0 booked calls; side hustle broad matched get-rich searches; [vending machines for sale] $53 / 14d on machine shoppers",
    after:
      "Phrase/exact replacements live (under review at 17:48): side hustle phrase, [vending machine business], [how to start a vending machine business], 4 Buy/Acquire route/business phrases, 3 Cost Research phrases. Phrase versions of license and brand new vending machine cost stay live",
    evidence:
      "Jess's non-brand recommendation (2026-10-27, Ads UI 90d booked calls); read-only GAQL check after the run confirmed every status",
    expected:
      "About $450/mo moves off zero-booking broad terms; booked calls held by the phrase/exact twins",
  },
  {
    at: "2026-10-27 21:56",
    kind: "campaigns",
    entity:
      "New VP | Side Income (test) (24410703799): 3 ad groups (Vending Side Hustle, Passive Income Vending, Side Business While Working), 26 phrase/exact keywords, 1 claim-free RSA each to /contact; $40/day from W2 (W2 $150 -> $110/day)",
    before:
      "0.4% of 90d search spend ($78 of $19.7k) reached side-hustle or passive-income searches; W2 negatives blocked passive income ideas/businesses",
    after:
      "Side Income on Maximize conversions, Google Search only, US presence, English, the same 11 shared negative lists and 11 sitelinks/callouts as W2, W2's campaign negatives minus the 4 passive terms plus 44 junk side-hustle negatives (online, apps, teens, jobs, crypto). W2 now negates side hustle, passive income, side business, side income, extra income, part time, second income so these searches route to the test",
    evidence:
      "Adam's call (2026-10-27): ICP is people with a day job wanting side or passive income; one atomic script run, 189 operations, read-only GAQL check after",
    expected:
      "Read at 2 and 4 weeks: cost per booked call vs W2's $149 baseline. W2 was already budget-constrained at $150, so watch its booked calls too",
  },
  {
    at: "2026-10-27 22:10",
    kind: "campaigns",
    entity:
      "W2 audiences in observation (bid only): in-market Business Services, Business Financial Services, Investment Services, Business Loans, Real Estate; affinity Avid Investors",
    before: "No audience data on W2",
    after:
      "Six segments observed, reach unchanged (targeting setting AUDIENCE bidOnly = true). A custom side-income search segment is not creatable from Ads Scripts; add it in the UI if wanted",
    evidence:
      "Adam's ICP call (2026-10-27): see whether investor and business-buyer audiences book cheaper before any bid change",
    expected:
      "Data only for 30 days; then bid up the segments that book cheaper",
  },
  {
    at: "2026-10-27 22:10",
    kind: "negatives",
    entity:
      'Shared list "Wasted intent 2026-10 (media buyer)": +rent to own, locations needing, twice the ice, automated convenience store. VP | Brand: +"meaning". W2: disapproved image asset 342004492122 unlinked',
    before:
      "12 zero-conversion terms at $233 / 90d in W2 and Brand; 4 of them (placement services, vendvice, vendscout, online franchise) were already negatives from 10-11",
    after:
      "The remaining wrong-intent terms blocked in every campaign using the list. buy vending machine franchise kept: vending machine franchise converts",
    evidence:
      "Search-term audit 2026-10-27 (W2 and Brand, 90d). The 35% of spend outside the intent buckets was converting generic vending searches ($3.7k) plus removed Competitive Conquest ($2.7k)",
    expected: "Small: under $50/mo of waste removed",
  },
];
