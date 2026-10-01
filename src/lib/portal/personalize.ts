// Client Journey Portal — the deterministic personalization rules (PRD §5).
//
// Pure functions, no I/O. Same inputs always produce the same page, so a rep
// (or George) can predict exactly what a prospect sees from occupation + ZIP +
// goal + stage. No per-prospect LLM guessing here by design.
//
// Persona → case study / testimonial mapping is Adam's first pass from the
// PRD table, adjusted to what the library actually has on video. PRD §12:
// Jess confirms. Charles Wheeler and Abby C exist only as written
// testimonials, so they lead the testimonial slot, not the video slot.

import timBarnes from "../../../data/case-studies/tim-barnes.json";
import tomCanterino from "../../../data/case-studies/tom-canarino.json";
import shan from "../../../data/case-studies/shan-25k-per-month.json";
import manuelDuval from "../../../data/case-studies/manuel-duval.json";
import parkers from "../../../data/case-studies/graham-and-katie-parker.json";
import thyroneLewis from "../../../data/case-studies/tyrone-lewis.json";
import {
  caseStudyQuotes,
  type CaseStudyQuote,
} from "@/lib/content/case-studies";
import { preCallResources } from "@/lib/content/pre-call-resources";
import type { PortalData, PortalObjectionId, PortalStage } from "./types";

export type PersonaId =
  | "employed"
  | "self_employed"
  | "between_jobs"
  | "relocated"
  | "family"
  | "default";

/**
 * First match wins, so order is the tie-break: "laid off engineer" is a
 * career change, not an employed engineer; "nurse building this with my
 * husband" is a family build.
 */
const PERSONA_RULES: ReadonlyArray<{ id: PersonaId; pattern: RegExp }> = [
  {
    id: "between_jobs",
    pattern:
      /\b(laid off|layoff|between jobs|unemployed|looking for work|job hunting|recent grad|graduate|student|quit|quitting|career change|severance)\b/i,
  },
  {
    id: "relocated",
    pattern:
      /\b(moved|moving|relocat\w*|new city|military|veteran|army|navy|air force|marine|spouse)\b/i,
  },
  {
    id: "family",
    pattern:
      /\b(wife|husband|kids|children|family|stay[- ]at[- ]home|mom|dad|parent)\b/i,
  },
  {
    id: "self_employed",
    pattern:
      /\b(owner|own my|founder|ceo|agency|self[- ]employed|realtor|real estate|broker|consultant|freelance\w*|contractor|marketing|lawyer|attorney|entrepreneur|investor)\b/i,
  },
  {
    id: "employed",
    pattern:
      /\b(teacher|coach|nurse|driver|manager|engineer|sales|rep|analyst|officer|police|firefighter|technician|accountant|developer|director|supervisor|employee|w-?2|corporate|retail|healthcare|physician|doctor|pharmacist)\b/i,
  },
];

export function bucketOccupation(
  occupation: string | null | undefined,
): PersonaId {
  const text = occupation?.trim();
  if (!text) return "default";
  return PERSONA_RULES.find((rule) => rule.pattern.test(text))?.id ?? "default";
}

export type PortalCaseStudy = {
  slug: string;
  name: string;
  role: string;
  title: string;
  excerpt: string;
  quote: string;
  videoId: string | null;
  stats: ReadonlyArray<{ label: string; value: string }>;
};

type CaseStudyJson = {
  slug: string;
  title: string;
  member_name: string;
  member_role: string;
  excerpt: string;
  quote: string;
  video_id?: string | null;
  stats: ReadonlyArray<{ label: string; value: string }>;
};

function toCaseStudy(json: CaseStudyJson): PortalCaseStudy {
  return {
    slug: json.slug,
    name: json.member_name,
    role: json.member_role,
    title: json.title,
    excerpt: json.excerpt,
    quote: json.quote,
    videoId: json.video_id ?? null,
    stats: json.stats.slice(0, 3),
  };
}

export type Persona = {
  id: PersonaId;
  /** Shown in the "People like you" eyebrow. Never names their job back. */
  label: string;
  caseStudy: PortalCaseStudy;
  testimonialId: CaseStudyQuote["id"];
  /** The pre-call objection video picked for this persona. */
  objectionId: PortalObjectionId;
};

const PERSONAS: Record<PersonaId, Persona> = {
  employed: {
    id: "employed",
    label: "Built around a full-time job",
    caseStudy: toCaseStudy(manuelDuval),
    testimonialId: "charles-wheeler",
    objectionId: "what-you-get",
  },
  self_employed: {
    id: "self_employed",
    label: "Business owners adding a second engine",
    caseStudy: toCaseStudy(tomCanterino),
    testimonialId: "bret-bourgeois",
    objectionId: "what-youll-earn",
  },
  between_jobs: {
    id: "between_jobs",
    label: "Started between jobs",
    caseStudy: toCaseStudy(timBarnes),
    testimonialId: "nolan-mayfield",
    objectionId: "financing",
  },
  relocated: {
    id: "relocated",
    label: "Started after a move",
    caseStudy: toCaseStudy(shan),
    testimonialId: "dewitts",
    objectionId: "securing-locations",
  },
  family: {
    id: "family",
    label: "Built as a family",
    caseStudy: toCaseStudy(parkers),
    testimonialId: "abby-c",
    objectionId: "cost-to-join",
  },
  default: {
    id: "default",
    label: "Started from zero",
    caseStudy: toCaseStudy(thyroneLewis),
    testimonialId: "kyle-sharp",
    objectionId: "cost-to-join",
  },
};

export function personaFor(occupation: string | null | undefined): Persona {
  return PERSONAS[bucketOccupation(occupation)];
}

export function testimonialFor(persona: Persona): CaseStudyQuote | null {
  return (
    caseStudyQuotes.find((quote) => quote.id === persona.testimonialId) ?? null
  );
}

export type ObjectionVideo = (typeof preCallResources.items)[number];

export function objectionVideo(id: PortalObjectionId): ObjectionVideo {
  // PORTAL_OBJECTION_IDS mirrors preCallResources ids; the test pins that.
  return preCallResources.items.find((item) => item.id === id)!;
}

/** Wins feed `winType` values per stage (PRD §5.3). */
export function winTypesFor(stage: PortalStage): readonly string[] {
  if (stage === "pre_call")
    return ["First machine live", "New location", "First contract"];
  if (stage === "lost") return [];
  return ["Revenue milestone", "Scale-up", "Hustle log"];
}

export type ModuleId =
  | "local"
  | "people"
  | "wins"
  | "faq"
  | "summary"
  | "onboarding"
  | "resources";

const DEFAULT_ORDER: Record<PortalStage, ModuleId[]> = {
  pre_call: ["local", "people", "wins", "faq", "resources"],
  post_call: ["summary", "people", "wins", "local", "resources"],
  won: ["onboarding", "wins", "local", "resources"],
  lost: ["people", "wins", "local", "resources"],
};

const GOAL_RULES: ReadonlyArray<{ module: ModuleId; pattern: RegExp }> = [
  {
    module: "faq",
    pattern: /\b(cost|budget|afford|money|financ\w*|credit|price|invest\w*)\b/i,
  },
  {
    module: "local",
    pattern: /\b(location|locations|area|city|town|near|local|map|where)\b/i,
  },
  {
    module: "people",
    pattern:
      /\b(quit|replace|income|earn|freedom|retire\w*|passive|family|time|side)\b/i,
  },
];

/** PRD §5.4: the module that matches their goal moves directly under the hero. */
export function moduleOrder(
  stage: PortalStage,
  goal: string | null | undefined,
): ModuleId[] {
  const order = DEFAULT_ORDER[stage];
  const text = goal?.trim();
  if (!text) return order;
  const match = GOAL_RULES.find(
    (rule) => order.includes(rule.module) && rule.pattern.test(text),
  );
  if (!match) return order;
  // Post-call summary and onboarding stay first: they ARE the stage.
  const pinned: ModuleId[] =
    order[0] === "summary" || order[0] === "onboarding" ? [order[0]] : [];
  const rest = order.filter(
    (id) => id !== match.module && !pinned.includes(id),
  );
  return [...pinned, match.module, ...rest];
}

export type NextStep = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  external?: boolean;
  done: boolean;
};

export function formatCallTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // ponytail: formatted in US Central, not the prospect's zone. Pass a
  // timezone from SteelTrap (or format client-side) when it matters.
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(date);
}

export const ONBOARDING_STEP_IDS = [
  "skool",
  "walkthrough",
  "location-search",
  "coaching",
] as const;

/** PRD §6.1: the spine. Always four-ish steps, always one obvious next one. */
export function nextSteps(data: PortalData): NextStep[] {
  const { stage, call, callSummary, onboarding } = data;
  const followUp = data.followUpUrl ?? "/contact";

  if (stage === "pre_call") {
    const when = formatCallTime(call?.scheduledAt);
    return [
      {
        id: "confirm",
        label: when ? `Confirm your call on ${when}` : "Confirm your call",
        href: call?.confirmUrl ?? "#call",
        external: Boolean(call?.confirmUrl),
        done: Boolean(call?.confirmed),
      },
      {
        id: "videos",
        label: "Watch the two videos picked for you",
        href: "#people",
        done: false,
      },
      {
        id: "map",
        label: "Look at your local opportunity map",
        href: "#local",
        done: false,
      },
      {
        id: "questions",
        label: "Bring your questions",
        href: "#faq",
        done: false,
      },
    ];
  }

  if (stage === "post_call") {
    return [
      {
        id: "summary",
        label: "Read your call summary",
        href: "#summary",
        done: false,
      },
      {
        id: "replay",
        label: "Revisit what was covered",
        detail: callSummary?.recordingUrl
          ? "Your recording is ready"
          : undefined,
        href: callSummary?.recordingUrl ?? "#summary",
        external: Boolean(callSummary?.recordingUrl),
        done: false,
      },
      {
        id: "main-question",
        label: "Watch the video that answers your main question",
        href: "#main-question",
        done: false,
      },
      {
        id: "follow-up",
        label: "Book your follow-up",
        href: followUp,
        external: followUp.startsWith("http"),
        done: false,
      },
    ];
  }

  if (stage === "won") {
    const done = new Set(onboarding?.completed ?? []);
    const step = (
      id: (typeof ONBOARDING_STEP_IDS)[number],
      label: string,
      href?: string | null,
    ) => ({
      id,
      label,
      href: href ?? "#onboarding",
      external: Boolean(href),
      done: done.has(id),
    });
    return [
      step("skool", "Accept your Skool invite", onboarding?.skoolInviteUrl),
      step(
        "walkthrough",
        "Complete the VendHub walkthrough",
        onboarding?.walkthroughUrl,
      ),
      step(
        "location-search",
        "Start your location search on the map",
        onboarding?.locationSearchUrl,
      ),
      step(
        "coaching",
        "Schedule your first coaching call",
        onboarding?.coachingCalendarUrl,
      ),
    ];
  }

  return [
    {
      id: "keep",
      label: "Keep your resources",
      detail: "This page stays live for you",
      href: "#resources",
      done: false,
    },
    {
      id: "wins",
      label: "See new wins as the community grows",
      href: "#wins",
      done: false,
    },
    {
      id: "rebook",
      label: "Rebook when you're ready",
      href: followUp,
      external: followUp.startsWith("http"),
      done: false,
    },
  ];
}
