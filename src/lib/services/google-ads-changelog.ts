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
];
