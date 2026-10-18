/**
 * One-glance summary at the top of /funnel-plan: the three funnel stages,
 * what we do at each, and the numbers behind it (snapshot 2026-10-18; the
 * sources are listed at the bottom of the plan).
 */
export type CheatSheetStage = {
  stage: "TOFU" | "MOFU" | "BOFU";
  audience: string;
  verdict: string;
  title: string;
  rules: { keep: boolean; text: string }[];
  chips: string[];
  evidence: string;
};

export const cheatSheetHeading = "Our content funnel, on one page";

export const cheatSheetStages: CheatSheetStage[] = [
  {
    stage: "TOFU",
    audience: '"What is" and "how to" content',
    verdict: "AI answers it now",
    title: "Mostly gone",
    rules: [
      {
        keep: false,
        text: "No new how-to articles. Google's AI and VendSoft already answer them.",
      },
      {
        keep: false,
        text: "Don't chase impressions: our articles drew 17,967 in 90 days and 2 search leads.",
      },
      {
        keep: true,
        text: "Keep the 20 we have live, each linking to a page that sells.",
      },
    ],
    chips: ["20 articles", "17,967 impressions", "2 leads"],
    evidence: "Search Console and site leads, Jul 19 to Oct 16",
  },
  {
    stage: "MOFU",
    audience: "Buyers comparing options",
    verdict: "Gets the click",
    title: "Buyers comparing options",
    rules: [
      {
        keep: true,
        text: "Buy a route vs build one, built around our YouTube video that already ranks #2.",
      },
      {
        keep: true,
        text: "Best vending coaching programs, plus honest head-to-heads with Hill Vending and Jaime Ibanez.",
      },
      {
        keep: true,
        text: "Case studies with real numbers and timelines. AI visitors already land on them.",
      },
    ],
    chips: ["X vs Y", "Alternatives", "Best for", "Case study"],
    evidence:
      '"vending machine success stories": 343 impressions, 0 clicks today',
  },
  {
    stage: "BOFU",
    audience: "Buyers ready to decide",
    verdict: "Closes deals",
    title: "Buyers ready to decide",
    rules: [
      {
        keep: true,
        text: "A reviews page that answers the Reddit thread ranking #1 for our name.",
      },
      {
        keep: true,
        text: "Pricing and process in plain words. Make Solutions and Process visible to Google.",
      },
      {
        keep: true,
        text: "FAQs from the objections our setters hear on Close calls.",
      },
    ],
    chips: ["Reviews", "Pricing", "Process", "FAQ", "Proof"],
    evidence:
      "Searches for our name plus review, cost or legit: 777 impressions, 40 clicks",
  },
];
