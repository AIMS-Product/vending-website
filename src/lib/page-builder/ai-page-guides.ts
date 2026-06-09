import { flattenBlocks, type PageContent } from "@/lib/page-builder/blocks";
import type { PageTypeId } from "@/lib/page-builder/page-templates";

export type SeoResourceGuideId =
  | "commercial-service"
  | "local-intent"
  | "use-case"
  | "how-to-guide"
  | "comparison"
  | "general-resource";

export type PageGuideId =
  | SeoResourceGuideId
  | "blog-standard"
  | "landing-standard"
  | "video-standard";

export type PageGuideSelection = {
  pageType: PageTypeId;
  primaryGuide: PageGuideId;
  secondarySignals: PageGuideId[];
  confidence: "high" | "medium" | "low";
};

export type PageGuideSelectionInput = {
  pageType: string;
  templateKey: string;
  title: string;
  slug: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  content: PageContent;
  latestUserMessage?: string | null;
};

type PageGuideDefinition = {
  id: PageGuideId;
  label: string;
  structure: string[];
  copyRules: string[];
  seoRules: string[];
};

const seoResourceGuides: Record<SeoResourceGuideId, PageGuideDefinition> = {
  "commercial-service": {
    id: "commercial-service",
    label: "Commercial service SEO page",
    structure: [
      "Hero with exact topic and clear service outcome",
      "Problem and buyer need",
      "Service or solution benefits",
      "Process or what happens next",
      "FAQ that resolves objections",
      "CTA or lead form",
    ],
    copyRules: [
      "Write for a buyer evaluating a service provider.",
      "Explain the commercial outcome and operational fit.",
      "Do not invent prices, guarantees, customer names, or performance stats.",
    ],
    seoRules: [
      "Use the exact target phrase in title/meta and one visible heading or body sentence.",
      "Add a clear /contact conversion path.",
      "Include FAQs that answer buyer objections.",
    ],
  },
  "local-intent": {
    id: "local-intent",
    label: "Local intent SEO page",
    structure: [
      "Hero with service plus location",
      "Local fit and service area context",
      "What the service includes",
      "Process for local enquiry",
      "FAQ for local logistics",
      "CTA or lead form",
    ],
    copyRules: [
      "Write for someone looking for service availability in a place.",
      "Mention local service context without inventing addresses or coverage guarantees.",
      "Keep location claims review-safe unless source evidence exists.",
    ],
    seoRules: [
      "Use the location phrase naturally in title/meta and visible copy.",
      "Include internal links or CTA paths that help the user enquire.",
      "Avoid doorway-page repetition; make the page useful for the location intent.",
    ],
  },
  "use-case": {
    id: "use-case",
    label: "Use-case SEO page",
    structure: [
      "Hero naming the scenario",
      "Why the use case matters",
      "Fit, requirements, or constraints",
      "Implementation or service process",
      "FAQ for objections and decision criteria",
      "CTA or lead form",
    ],
    copyRules: [
      "Write for the person responsible for the scenario or placement context.",
      "Explain practical fit and decision criteria, not just generic benefits.",
      "Avoid fake compliance, revenue, or operational claims.",
    ],
    seoRules: [
      "Use the exact use-case phrase in metadata and visible copy.",
      "Answer likely scenario-specific questions in FAQ.",
      "Include a clear next step for evaluating the placement.",
    ],
  },
  "how-to-guide": {
    id: "how-to-guide",
    label: "How-to guide SEO page",
    structure: [
      "Hero with the task or learning goal",
      "Short answer or overview",
      "Step-by-step process",
      "Requirements, mistakes, or considerations",
      "FAQ",
      "CTA for expert help",
    ],
    copyRules: [
      "Teach the process in plain, actionable language.",
      "Make steps concrete without pretending to know the user's exact situation.",
      "Do not invent regulations, costs, or timelines.",
    ],
    seoRules: [
      "Use the how-to phrase in title/meta and a visible heading.",
      "Prefer ordered process copy and FAQ coverage.",
      "Link the reader to a consultation or next action when help is needed.",
    ],
  },
  comparison: {
    id: "comparison",
    label: "Comparison SEO page",
    structure: [
      "Hero with comparison question",
      "Quick recommendation or decision frame",
      "Option cards or comparison grid",
      "Pros, cons, and fit criteria",
      "FAQ",
      "CTA for choosing the right option",
    ],
    copyRules: [
      "Help the reader choose between options.",
      "Use balanced, decision-oriented copy.",
      "Do not create fake rankings, awards, or review claims.",
    ],
    seoRules: [
      "Use comparison language such as best, vs, compare, or options when present in the keyword.",
      "Include headings that match the comparison intent.",
      "Add a CTA for advice or option selection.",
    ],
  },
  "general-resource": {
    id: "general-resource",
    label: "General resource SEO page",
    structure: [
      "Hero with topic and promise",
      "Overview of the topic",
      "Key benefits or considerations",
      "Common questions",
      "CTA or lead form",
    ],
    copyRules: [
      "Create a helpful first draft when intent is broad.",
      "Prioritize clarity, completeness, and review-safe claims.",
      "Avoid filler and keyword stuffing.",
    ],
    seoRules: [
      "Use the target phrase naturally in metadata and visible copy.",
      "Cover enough topic depth to be useful.",
      "Include a clear conversion path.",
    ],
  },
};

const stubGuides: Record<
  Exclude<PageTypeId, "resource">,
  PageGuideDefinition
> = {
  blog: {
    id: "blog-standard",
    label: "Blog page guide stub",
    structure: ["Hook", "Intro", "Scannable body", "Conclusion", "CTA"],
    copyRules: ["Use article-style flow. Detailed blog guides are pending."],
    seoRules: ["Use descriptive title, headings, and internal links."],
  },
  landing: {
    id: "landing-standard",
    label: "Landing page guide stub",
    structure: ["Hero", "Offer", "Proof", "Objections", "CTA"],
    copyRules: [
      "Focus on one conversion goal. Detailed landing guides are pending.",
    ],
    seoRules: ["Keep metadata clear and aligned with the offer."],
  },
  video: {
    id: "video-standard",
    label: "Video page guide stub",
    structure: ["Hero", "Video", "Summary", "Supporting copy", "CTA"],
    copyRules: ["Center the video and explain why it matters."],
    seoRules: ["Use descriptive video title/description and supporting copy."],
  },
};

export function selectPageGuide(
  input: PageGuideSelectionInput,
): PageGuideSelection {
  const pageType = normalizePageType(input.pageType);
  if (pageType !== "resource") {
    return {
      pageType,
      primaryGuide: stubGuides[pageType].id,
      secondarySignals: [],
      confidence: "low",
    };
  }

  const matches = matchedSeoGuides(input);
  const primaryGuide = matches[0] ?? "general-resource";
  return {
    pageType,
    primaryGuide,
    secondarySignals: matches.filter((guide) => guide !== primaryGuide),
    confidence:
      matches.length > 0
        ? flattenBlocks(input.content).length > 0
          ? "medium"
          : "high"
        : "low",
  };
}

export function renderPageGuidePrompt(selection: PageGuideSelection) {
  const guide = pageGuideDefinition(selection.primaryGuide);
  const secondary = selection.secondarySignals
    .map((id) => pageGuideDefinition(id).label)
    .join(", ");

  return [
    "Internal page guide:",
    `- Hidden guide selection: ${guide.label}. Do not mention this guide name to the user.`,
    `- Selection confidence: ${selection.confidence}.`,
    secondary ? `- Secondary signals to blend: ${secondary}.` : null,
    "- Structure guide:",
    ...guide.structure.map((item) => `  - ${item}`),
    "- Copy rules:",
    ...guide.copyRules.map((item) => `  - ${item}`),
    "- SEO rules:",
    ...guide.seoRules.map((item) => `  - ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function pageGuideDefinition(id: PageGuideId): PageGuideDefinition {
  if (id in seoResourceGuides) {
    return seoResourceGuides[id as SeoResourceGuideId];
  }
  return Object.values(stubGuides).find((guide) => guide.id === id)!;
}

function matchedSeoGuides(
  input: PageGuideSelectionInput,
): SeoResourceGuideId[] {
  const text = guideSearchText(input);
  const matches: SeoResourceGuideId[] = [];

  if (/\b(how to|steps?|start|starting|process|guide to|learn)\b/.test(text)) {
    matches.push("how-to-guide");
  }
  if (
    /\b(best|vs\.?|versus|compare|comparison|alternatives?|options?)\b/.test(
      text,
    )
  ) {
    matches.push("comparison");
  }
  if (
    /\b(dorm|dormitor|campus|school|college|office|workplace|gym|hospital|hotel|apartment|warehouse|factory|staff room|break room)\b/.test(
      text,
    )
  ) {
    matches.push("use-case");
  }
  if (
    /\b(near me|local|adelaide|sydney|melbourne|brisbane|perth|australia|sa|nsw|vic|qld|wa)\b/.test(
      text,
    )
  ) {
    matches.push("local-intent");
  }
  if (
    /\b(service|services|solution|solutions|provider|company|installation|managed|supplier|operator)\b/.test(
      text,
    )
  ) {
    matches.push("commercial-service");
  }

  return [...new Set(matches)];
}

function guideSearchText(input: PageGuideSelectionInput) {
  return [
    input.latestUserMessage,
    input.targetKeyword,
    input.title,
    input.slug,
    input.seoTitle,
    input.metaDescription,
    input.templateKey,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizePageType(pageType: string): PageTypeId {
  if (
    pageType === "resource" ||
    pageType === "blog" ||
    pageType === "landing" ||
    pageType === "video"
  ) {
    return pageType;
  }
  return "resource";
}
