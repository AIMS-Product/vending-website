import {
  CASE_STUDY_SUMMARIES,
  type CaseStudySummary,
} from "@/lib/chatbot/site-knowledge";

/**
 * Picks the member story for the share_case_study tool. Deterministic on
 * purpose: the model says what it learned ("teacher, two kids, worried about
 * time"), this picks the member from the case studies' own tags and prior
 * jobs, so the model never types a slug (which is how /case-studies/mallorie-
 * rauch got linked seven times in September) and never picks a story that
 * does not fit.
 *
 * ponytail: keyword rules over a closed list of 25 studies. Upgrade to an
 * embedding match if the library grows past what a reviewer can eyeball.
 */

type Rule = { pattern: RegExp; tags: Record<string, number> };

const RULES: readonly Rule[] = [
  {
    pattern: /\b(stay[- ]at[- ]home|sahm|homemaker)\b/i,
    tags: { "stay-at-home-parent": 3, "icp-stay-at-home-parent": 3 },
  },
  {
    pattern: /\b(mom|dad|mother|father|kids?|children|parent|family)\b/i,
    tags: { "raising-kids": 2, "with-their-kids": 1 },
  },
  {
    pattern: /\bretir(e|ed|ing|ement|ee)\b/i,
    tags: { retiree: 3, "icp-retired": 3 },
  },
  {
    pattern:
      /\b(police|cop|sheriff|detective|law enforcement|firefight\w*|fire ?fighter|first responder|paramedic)\b/i,
    tags: { "from-public-safety": 3 },
  },
  {
    pattern: /\b(military|veteran|army|navy|marines?|air force)\b/i,
    tags: { "icp-military": 3 },
  },
  {
    pattern:
      /\b(nurse|nursing|doctor|physician|medical|hospital|health ?care|dental|pharmac\w*)\b/i,
    tags: { "from-healthcare": 3 },
  },
  {
    pattern: /\b(teacher|teaching|educator|school)\b/i,
    tags: { "kept-the-day-job": 2, "part-time": 1 },
  },
  {
    pattern: /\b(sales|salesman|saleswoman|account executive)\b/i,
    tags: { "from-sales": 3 },
  },
  {
    pattern: /\b(real estate|realtor|rental propert\w*)\b/i,
    tags: { "from-real-estate": 3 },
  },
  {
    pattern: /\b(software|engineer\w*|developer|tech|programmer)\b/i,
    tags: { "from-tech": 3 },
  },
  {
    pattern: /\b(bank\w*|finance|financial|accountant|accounting|auditor)\b/i,
    tags: { "from-finance": 3 },
  },
  {
    pattern:
      /\b(restaurant|chef|cook|bartender|hospitality|food truck|hotel)\b/i,
    tags: { "from-food-hospitality": 3 },
  },
  {
    pattern:
      /\b(truck\w*|driver|electrician|plumb\w*|construction|mechanic|welder|hvac|contractor|carpenter|warehouse|factory|blue[- ]collar|trades?|mail carrier)\b/i,
    tags: { "from-trades": 3, "icp-blue-collar": 3 },
  },
  {
    pattern: /\b(fitness|personal trainer|gym)\b/i,
    tags: { "from-fitness": 3 },
  },
  {
    pattern: /\b(corporate|office|9 ?to ?5|manager|retail|w-?2|salaried)\b/i,
    tags: { "from-corporate": 2, "icp-leaving-w2": 2 },
  },
  {
    pattern: /\b(full[- ]time|day job|busy schedule|work long hours)\b/i,
    tags: { "kept-the-day-job": 3 },
  },
  {
    pattern:
      /\b(side (income|hustle|business)|part[- ]time|extra income|on the side)\b/i,
    tags: { "part-time": 3, "kept-the-day-job": 1 },
  },
  {
    pattern: /\b(laid off|layoff|lost my job|unemployed|between jobs)\b/i,
    tags: { "laid-off": 3, "between-jobs": 2, "icp-laid-off": 3 },
  },
  {
    pattern:
      /\b(quit|replace my (job|income|salary)|leave my job|get out of (corporate|my job))\b/i,
    tags: { "quit-the-job": 2, "icp-leaving-w2": 2 },
  },
  {
    pattern:
      /\b(no experience|never (done|run|owned)|beginner|brand new|zero experience|first business|don'?t know anything)\b/i,
    tags: { "no-experience": 3 },
  },
  {
    pattern: /\b(wife|husband|spouse|partner)\b/i,
    tags: { "with-spouse": 2 },
  },
  {
    pattern: /\b(college|student|graduat\w*|in my 20s|twenties)\b/i,
    tags: { "icp-young-professional": 2, "recent-grad": 2 },
  },
  {
    pattern: /\b(in my (50|60)s|over (50|60)|fifties|sixties)\b/i,
    tags: { "started-after-50": 2 },
  },
  {
    pattern:
      /\b(money is tight|tight on money|broke|can'?t afford|not much money|limited (budget|capital))\b/i,
    tags: { "money-was-tight": 3 },
  },
  {
    pattern:
      /\b(own (a|my) business|self[- ]employed|entrepreneur|business owner)\b/i,
    tags: { "already-self-employed": 2, "icp-entrepreneur": 2 },
  },
  {
    pattern: /\b(burn(ed|t) out|burnout|exhausted|hate my job|tired of)\b/i,
    tags: { "burned-out": 2 },
  },
];

/** The visitor's main worry, as the model names it. Maps to `objection-*` tags. */
export const CASE_STUDY_OBJECTIONS = [
  "price",
  "spouse",
  "timing",
  "implementation",
  "need-fit",
  "trust",
  "roi",
  "diy",
  "status-quo",
] as const;

export type CaseStudyObjection = (typeof CASE_STUDY_OBJECTIONS)[number];

/** Bonus when a matched rule also names the member's own prior job. */
const OCCUPATION_BONUS = 2;
const OBJECTION_WEIGHT = 3;

/**
 * The stories the team already leads with in chat (the prompt's testimonial
 * guide). A one-point nudge, so a weak match ("I'm a teacher") lands on a
 * member the team chose to feature rather than on whoever has fewest tags.
 */
const FEATURED_SLUGS = new Set([
  "mallerie-rouch",
  "andy-consulman",
  "lane-200k-per-year",
  "shan-25k-per-month",
  "matt-dicks",
  "manuel-duval",
  "madison-6-locations",
  "michael-d-600k-per-year",
]);

export function matchCaseStudy(input: {
  situation: string;
  objection?: string | null;
  excludeSlugs?: readonly string[];
}): CaseStudySummary | null {
  const situation = input.situation.trim();
  const matched = RULES.filter((rule) => rule.pattern.test(situation));
  const objectionTag = CASE_STUDY_OBJECTIONS.includes(
    input.objection as CaseStudyObjection,
  )
    ? `objection-${input.objection}`
    : null;
  // A job, a goal or a worry is enough; with none of them there is no match.
  if (matched.length === 0 && !objectionTag) return null;
  const excluded = new Set(input.excludeSlugs ?? []);

  let best: { study: CaseStudySummary; score: number } | null = null;
  for (const study of CASE_STUDY_SUMMARIES) {
    if (excluded.has(study.slug)) continue;
    const tags = new Set(study.tags);
    let score = 0;
    for (const rule of matched) {
      for (const [tag, weight] of Object.entries(rule.tags)) {
        if (tags.has(tag)) score += weight;
      }
      if (rule.pattern.test(study.priorBackground)) score += OCCUPATION_BONUS;
    }
    if (objectionTag && tags.has(objectionTag)) score += OBJECTION_WEIGHT;
    if (score === 0) continue;
    if (FEATURED_SLUGS.has(study.slug)) score += 1;

    // Ties go to the more focused story (fewer tags), then file order.
    if (
      !best ||
      score > best.score ||
      (score === best.score && study.tags.length < best.study.tags.length)
    ) {
      best = { study, score };
    }
  }
  return best?.study ?? null;
}
