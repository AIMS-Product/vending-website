// Client Journey Portal — the data contract.
//
// This is the ONE shape the portal page renders from. Today it is filled by
// fixtures (./fixtures.ts). SteelTrap fills it next: see
// docs/client-portal/HANDOFF.md. Everything the prospect sees that is not in
// here (persona match, case study, testimonial, wins categories, next steps,
// module order) is derived on this side by ./personalize.ts, so the backend
// only ever has to send facts, never copy.
//
// Sparse by design (PRD §5): name alone must render a complete page. Every
// field past `firstName` is optional or nullable and has a rendered default.

export type PortalStage = "pre_call" | "post_call" | "won" | "lost";

export type PortalRep = {
  name: string;
  title?: string | null;
  photoUrl?: string | null;
};

export type PortalCall = {
  /** ISO 8601 with offset. Null = booked but time unknown to us. */
  scheduledAt: string | null;
  /** Prospect clicked "confirm". Drives step 1 of the pre-call spine. */
  confirmed: boolean;
  /** Where "Confirm your call" goes (calendar event / confirm endpoint). */
  confirmUrl?: string | null;
  rescheduleUrl?: string | null;
  rep: PortalRep;
};

/** One ranked spot from VendScout around the prospect's ZIP. */
export type PortalLocation = {
  rank: number;
  name: string;
  /** e.g. "Office", "Gym", "Hospital", "Apartments". */
  type: string;
  distanceMi: number;
  /** Map position. Optional: the list renders without it. */
  lat?: number | null;
  lng?: number | null;
  /** VendScout foot-traffic signal, 0-100. */
  trafficScore?: number | null;
};

/** ZIP → VendScout render + pre-call research GPT brief. */
export type PortalLocalMarket = {
  zip: string;
  city: string;
  state: string;
  center: { lat: number; lng: number };
  /** Research GPT market brief, plain-text paragraphs. */
  brief: string[];
  /** Research GPT "what your first 90 days could look like". */
  first90Days: Array<{ label: string; detail: string }>;
  locations: PortalLocation[];
};

/** Avoma transcript → Claude customer-facing summary (PRD §7). */
export type PortalCallSummary = {
  publishedAt: string;
  /** Avoma recording share link. Null hides the replay button. */
  recordingUrl?: string | null;
  discussed: string[];
  yourQuestions: Array<{ question: string; answer: string }>;
  recommended: string[];
  highlights: Array<{ timestamp?: string | null; quote: string; why: string }>;
  /**
   * The objection the prospect led with, as one of the pre-call video ids
   * (see PORTAL_OBJECTION_IDS). Picks "the video that answers your main
   * question" on the post-call spine.
   */
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

export type PortalOnboarding = {
  skoolInviteUrl: string;
  walkthroughUrl: string;
  locationSearchUrl: string;
  coachingCalendarUrl: string;
  machineSourcingUrl?: string | null;
  /** Ids from ONBOARDING_STEP_IDS the member has already done. */
  completed: string[];
};

export type PortalData = {
  token: string;
  stage: PortalStage;
  prospect: {
    firstName: string;
    lastName?: string | null;
    /** Free text from booking/intake. Bucketed by personalize.ts. */
    occupation?: string | null;
    zip?: string | null;
    /** Optional intake goal. Reorders modules (PRD §5.4). */
    goal?: string | null;
  };
  /** Null when there is no booked call (self-guided / closed-lost). */
  call: PortalCall | null;
  localMarket: PortalLocalMarket | null;
  callSummary: PortalCallSummary | null;
  onboarding: PortalOnboarding | null;
  /** Post-call / lost: where "book your follow-up" and "rebook" go. */
  followUpUrl?: string | null;
};
