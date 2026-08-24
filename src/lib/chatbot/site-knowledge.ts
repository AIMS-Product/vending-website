import "server-only";

import { z } from "zod";
import { staticRoutes } from "@/lib/content/site-routes";
import {
  financeTemplatesLandingPage,
  roadmapLandingPage,
} from "@/lib/content/lead-magnets";

// Static imports (not fs.readdirSync): Next.js/Vercel traces static imports
// into the serverless bundle automatically, so these 25 files are guaranteed
// to ship with the function. A runtime directory read into `data/` has no
// such guarantee and can 404 in production while working locally.
import andyConsulman from "../../../data/case-studies/andy-consulman.json";
import anthonyKolodziej from "../../../data/case-studies/anthony-kolodziej.json";
import dj50kPerMonth from "../../../data/case-studies/dj-50k-per-month.json";
import evanTomahong from "../../../data/case-studies/evan-tomahong.json";
import grahamAndKatieParker from "../../../data/case-studies/graham-and-katie-parker.json";
import jason500Machines from "../../../data/case-studies/jason-500-machines.json";
import javierZeder from "../../../data/case-studies/javier-zeder.json";
import jesseLee from "../../../data/case-studies/jesse-lee.json";
import joeRetireeRoute from "../../../data/case-studies/joe-retiree-route.json";
import johnAndLaurenSanchez from "../../../data/case-studies/john-and-lauren-sanchez.json";
import johnRealEstateAgent from "../../../data/case-studies/john-real-estate-agent.json";
import kyle40kPerMonth from "../../../data/case-studies/kyle-40k-per-month.json";
import lane200kPerYear from "../../../data/case-studies/lane-200k-per-year.json";
import madison6Locations from "../../../data/case-studies/madison-6-locations.json";
import mallerieRouch from "../../../data/case-studies/mallerie-rouch.json";
import manuelDuval from "../../../data/case-studies/manuel-duval.json";
import mattDicks from "../../../data/case-studies/matt-dicks.json";
import mattMorrison from "../../../data/case-studies/matt-morrison.json";
import michaelD600kPerYear from "../../../data/case-studies/michael-d-600k-per-year.json";
import musaSadi from "../../../data/case-studies/musa-sadi.json";
import sandyAndJoe from "../../../data/case-studies/sandy-and-joe.json";
import shan25kPerMonth from "../../../data/case-studies/shan-25k-per-month.json";
import timBarnes from "../../../data/case-studies/tim-barnes.json";
import tomCanarino from "../../../data/case-studies/tom-canarino.json";
import tyroneLewis from "../../../data/case-studies/tyrone-lewis.json";

const CASE_STUDY_FILES: unknown[] = [
  andyConsulman,
  anthonyKolodziej,
  dj50kPerMonth,
  evanTomahong,
  grahamAndKatieParker,
  jason500Machines,
  javierZeder,
  jesseLee,
  joeRetireeRoute,
  johnAndLaurenSanchez,
  johnRealEstateAgent,
  kyle40kPerMonth,
  lane200kPerYear,
  madison6Locations,
  mallerieRouch,
  manuelDuval,
  mattDicks,
  mattMorrison,
  michaelD600kPerYear,
  musaSadi,
  sandyAndJoe,
  shan25kPerMonth,
  timBarnes,
  tomCanarino,
  tyroneLewis,
];

const caseStudyFileSchema = z.object({
  slug: z.string().min(1),
  member_name: z.string().min(1),
  member_role: z.string().nullable().optional(),
  prior_occupation: z.string().nullable().optional(),
  monthly_revenue_usd: z.number().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  stats: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional()
    .default([]),
});

export type CaseStudySummary = {
  slug: string;
  memberName: string;
  priorBackground: string;
  headlineResult: string;
  tags: readonly string[];
  url: string;
};

/**
 * Parsed once at module load. A malformed file is skipped with a warning
 * rather than crashing prompt assembly for every visitor.
 */
function loadCaseStudySummaries(): CaseStudySummary[] {
  const summaries: CaseStudySummary[] = [];
  for (const raw of CASE_STUDY_FILES) {
    const parsed = caseStudyFileSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("chatbot: skipping malformed case study file", {
        error: parsed.error.issues[0]?.message,
      });
      continue;
    }
    const data = parsed.data;
    summaries.push({
      slug: data.slug,
      memberName: data.member_name,
      priorBackground:
        data.prior_occupation || data.member_role || "background not stated",
      headlineResult: headlineResult(data),
      tags: data.tags,
      url: `/case-studies/${data.slug}`,
    });
  }
  return summaries;
}

/**
 * Stat labels that describe what a member SPENT, not what they earned. One
 * case study carries a "Setup Cost" stat, and it is index 2 today so the
 * slice below happens to miss it. That is luck, not a guarantee: a single
 * reorder of that JSON file would put a dollar cost into the system prompt,
 * and the bot restating an individual member's setup cost as the program's
 * price is exactly the failure this filter exists to make impossible.
 * Prices never enter the prompt (see PROGRAM_FACTS and the CONTENT RULES).
 */
const COST_STAT_LABEL_PATTERN = /cost|price|invest|spend|capital|startup|fee/i;

function headlineResult(data: z.infer<typeof caseStudyFileSchema>): string {
  const resultStats = data.stats.filter(
    (stat) => !COST_STAT_LABEL_PATTERN.test(stat.label),
  );
  if (resultStats.length > 0) {
    return resultStats
      .slice(0, 2)
      .map((stat) => `${stat.label.toLowerCase()} ${stat.value}`)
      .join(", ");
  }
  if (data.monthly_revenue_usd) {
    return `~$${Math.round(data.monthly_revenue_usd / 1000)}K/mo`;
  }
  return "results not quantified";
}

export const CASE_STUDY_SUMMARIES: readonly CaseStudySummary[] =
  loadCaseStudySummaries();

function buildCaseStudyIndex(): string {
  return CASE_STUDY_SUMMARIES.map(
    (study) =>
      `- ${study.memberName} — was ${study.priorBackground} — now ${study.headlineResult} — tags: ${study.tags.join("/") || "none"} — ${study.url}`,
  ).join("\n");
}

function buildCollateralIndex(): string {
  const items = [
    {
      name: roadmapLandingPage.title,
      whatItIs:
        "Free 90-day launch plan: pick a machine, land the first location, launch and scale.",
      url: roadmapLandingPage.route_path,
    },
    {
      name: financeTemplatesLandingPage.title,
      whatItIs:
        "Free self-calculating P&L, cash flow, and balance sheet workbook for a vending route.",
      url: financeTemplatesLandingPage.route_path,
    },
  ];
  return items
    .map((item) => `- ${item.name} — ${item.whatItIs} — ${item.url}`)
    .join("\n");
}

function buildRouteMap(): string {
  const collateralRoutes = [
    roadmapLandingPage.route_path,
    financeTemplatesLandingPage.route_path,
  ];
  const routes = [
    ...staticRoutes.map((route) => route.path),
    ...collateralRoutes,
  ];
  return routes.join(", ");
}

/**
 * What Vendingpreneurs is, who it's for, how the call/apply flow works, and
 * the headline proof points — distilled from src/lib/content/home.ts,
 * about.ts, and apply-page.ts so the bot never invents numbers.
 */
const PROGRAM_FACTS = `Vendingpreneurs is a mentorship community and accelerator program (founded by Mike Hoffman) that teaches people how to launch and scale a vending machine or micro-market route, from zero experience through full-time income. The program includes step-by-step training, weekly group coaching plus 1-on-1 ambassador sessions, pre-negotiated discounts on machines and bulk product, and a community of active operators.
Typical member proof points: 850+ entrepreneurs launched, 3,000+ locations placed, $3 million+ in vending sales. Program averages: 10-15 hours a week to run a route, under 30 days to place a first machine (results vary by market, capital, and effort, and are never guarantees).
COST AND PRICING: you do not know what anything costs and there is no published number. There are several different plans, and a lot of financing partners, so what someone actually pays depends entirely on which plan fits their goals. Nobody can quote that in a chat, and no figure you might infer from the numbers above is a price. The only correct answer to any cost question is the plans-and-financing line plus the calendar.
How to get started: the visitor books a free strategy call at /contact (also reachable at /book-now). There is a short qualification quiz first; after it they're offered a call time. No purchase is required to book or take the call.`;

/**
 * The full static context block, assembled once at module load and reused
 * for every request. Case-study index (~25 lines) + collateral (2 lines) +
 * program facts (~150 words) + route map comfortably fits the ~6000 token
 * ceiling for the whole system prompt.
 */
export const SITE_KNOWLEDGE_BLOCK = [
  "PROGRAM FACTS:",
  PROGRAM_FACTS,
  "",
  "CASE STUDY INDEX (match by the visitor's stated background; offer the one real story that fits best):",
  buildCaseStudyIndex(),
  "",
  "COLLATERAL (offer by name, as the deliverable that justifies an email ask):",
  buildCollateralIndex(),
  "",
  `SITE PAGES: ${buildRouteMap()}`,
].join("\n");
