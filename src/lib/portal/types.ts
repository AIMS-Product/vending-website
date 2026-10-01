// Client Journey Portal: the data contract.
//
// The ONE shape the portal renders from. Today it is filled by fixtures
// (./fixtures.ts); in SteelTrap it is filled by the portal read model (see
// docs/client-portal/HANDOFF.md). Names follow the architecture doc
// (client-portal-architecture-2026-10-01): subject, instance, access grant,
// journey definition/steps, step state, question.
//
// Sparse by design: firstName alone must render a complete page. Every other
// field is optional or nullable and has a rendered default.

export type PortalStage = "pre_call" | "post_call" | "won" | "lost";

/**
 * Arch doc §5.3. "link" = generated-link material only (general education +
 * safe personal shell). "verified" = the bound email was verified, so private
 * call material and questions may be served. The SERVER decides this and
 * omits private fields when it is "link"; the UI never hides private data
 * that was already sent.
 */
export type PortalAccess = "link" | "verified";

export type PortalRep = {
  name: string;
  title?: string | null;
  photoUrl?: string | null;
};

export type PortalCall = {
  /** ISO 8601 with offset. Null = booked but time unknown. */
  scheduledAt: string | null;
  /** Where "Confirm your call" goes. */
  confirmUrl?: string | null;
  rescheduleUrl?: string | null;
  /** Video link for the call itself, if any. */
  joinUrl?: string | null;
  rep: PortalRep;
};

/** One ranked spot near the prospect (VendScout). */
export type PortalLocation = {
  rank: number;
  name: string;
  /** e.g. "Healthcare", "Gym", "Apartments", "Office". */
  type: string;
  distanceMi: number;
  lat: number;
  lng: number;
};

/** ZIP → VendScout ranked locations + research brief (cached, never generated on page view). */
export type PortalLocalMarket = {
  zip: string;
  city: string;
  state: string;
  center: { lat: number; lng: number };
  /** Plain-text paragraphs. Every claim must be sourced upstream. */
  brief: string[];
  locations: PortalLocation[];
};

/** Avoma transcript → prospect-safe summary. Only present when access === "verified". */
export type PortalCallSummary = {
  publishedAt: string;
  recordingUrl?: string | null;
  discussed: string[];
  yourQuestions: Array<{ question: string; answer: string }>;
  recommended: string[];
  highlights: Array<{ timestamp?: string | null; quote: string; why: string }>;
  /** The objection they led with; picks "the video that answers your main question". */
  mainQuestionId?: PortalObjectionId | null;
};

export const PORTAL_OBJECTION_IDS = [
  "cost-to-join",
  "what-you-get",
  "securing-locations",
  "machine-cost",
  "financing",
  "what-youll-earn",
] as const;
export type PortalObjectionId = (typeof PORTAL_OBJECTION_IDS)[number];

export type PortalOnboardingLinks = {
  skoolInviteUrl: string;
  walkthroughUrl: string;
  locationSearchUrl: string;
  coachingCalendarUrl: string;
};

/**
 * What renders inside a step when it is opened. A content slot, not copy:
 * the journey definition says WHICH slot, the portal fills it from the
 * prospect's data and the approved asset catalog.
 */
export type StepContentKind =
  | "confirm_call"
  | "intake"
  | "persona_story"
  | "objection_video"
  | "local_map"
  | "call_prep"
  | "call"
  | "verify_email"
  | "call_summary"
  | "main_question"
  | "book_follow_up"
  | "link"
  | "wins";

/** Arch doc `journey_step`. Published, versioned, data not code. */
export type JourneyStep = {
  key: string;
  title: string;
  /** One line under the title. */
  detail?: string;
  /** Rough time it takes, shown as "6 min". */
  minutes?: number;
  /**
   * When it is due, in days from the stage anchor (call day for pre/post
   * call, join day for won). 0 = anchor day; negative = before it.
   */
  dayOffset: number;
  content: StepContentKind;
  /** For content "link": where it goes. */
  href?: string;
  /** "prospect" = they tick it; "system" = an event completes it (call held, email verified). */
  completedBy: "prospect" | "system";
};

export type JourneyDefinition = {
  key: string;
  version: number;
  steps: JourneyStep[];
};

export type PortalData = {
  token: string;
  stage: PortalStage;
  access: PortalAccess;
  prospect: {
    firstName: string;
    lastName?: string | null;
    occupation?: string | null;
    zip?: string | null;
    goal?: string | null;
    /** Masked bound email for the verify prompt, e.g. "s•••@gmail.com". Never the full address. */
    emailHint?: string | null;
  };
  call: PortalCall | null;
  /** Won stage anchor. ISO date the member joined. */
  joinedAt?: string | null;
  localMarket: PortalLocalMarket | null;
  /** Present only when access === "verified" and a summary is published. */
  callSummary: PortalCallSummary | null;
  onboarding: PortalOnboardingLinks | null;
  followUpUrl?: string | null;
  /** Null = use the default journey for the stage (./journey.ts). */
  journey: JourneyDefinition | null;
  /** Arch doc `portal_step_state`: keys of completed steps. */
  completedSteps: string[];
};
