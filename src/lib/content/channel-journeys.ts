/**
 * The channel journeys: which real pages make up each channel's funnel, in
 * order, and where each step's number comes from.
 *
 * This is the one file in the repo that no data source can replace. The
 * database knows that 1,040 sessions landed on /booking-youtube and that 150
 * YouTube leads exist; it does not know that the video comes before the page,
 * that the page is where the lead is meant to be captured, or that anything
 * after it belongs to the same story. That ordering is marketing's knowledge,
 * and it lives here so the map can be corrected by editing one list rather
 * than by re-deriving a graph.
 *
 * Mirrors the Q4 Marketing Channel Maps FigJam board. When the board and this
 * file disagree, the board is right and this file is stale.
 *
 * `channel` must be a value `resolveChannel` produces, or the lane matches no
 * rows. `paths` are canonical site paths — a redirected URL is folded into its
 * destination before matching, so list the page as it is served today.
 */

export type JourneyStep = {
  /** Stable key; also the column key in the detail table. */
  key: string;
  label: string;
  /** One line under the label saying what the number counts. */
  detail?: string;
} & (
  | {
      /**
       * What the platform reports about its own surface, before anyone
       * reaches the site. Not comparable with a GA4 number: two systems
       * counting two different things.
       */
      kind: "reach";
      metric: "impressions" | "clicks";
    }
  | {
      /** GA4 sessions landing on these paths, from this channel only. */
      kind: "page";
      paths: readonly string[];
    }
  /** Webinar registrations, from the webinar receiver. */
  | { kind: "registrations" }
  /** A lead row captured on one of the lane's pages. */
  | { kind: "lead" }
  /** Of those leads, the ones who finished the qualification questions. */
  | { kind: "questions" }
  | { kind: "booked" }
  | { kind: "showed" }
  | { kind: "won" }
);

export type ChannelJourney = {
  key: string;
  label: string;
  /**
   * Every canonical channel this lane claims, as `resolveChannel` returns
   * them. A list because one platform can produce two channels: a Meta link
   * with a paid medium resolves to "Meta Ads" and the same link without one
   * resolves to "Meta", and splitting those across two lanes reports one
   * budget as two funnels, both of them wrong.
   */
  channels: readonly string[];
  /** Shown under the lane. Use it for what the numbers cannot say. */
  note?: string;
  steps: readonly JourneyStep[];
};

/** The stages every lane ends with, because every lane ends the same way. */
const CLOSING_STEPS: readonly JourneyStep[] = [
  {
    key: "lead",
    kind: "lead",
    label: "Lead",
    detail: "Contact details captured on one of the pages above",
  },
  {
    key: "questions",
    kind: "questions",
    label: "Qualified",
    detail: "Finished the scored questions",
  },
  {
    key: "booked",
    kind: "booked",
    label: "Booked",
    detail: "A call on the calendar",
  },
  {
    key: "showed",
    kind: "showed",
    label: "Showed",
    detail: "Turned up, per Close",
  },
  { key: "won", kind: "won", label: "Won", detail: "Closed/won in Close" },
];

/**
 * The Webinar lane's closing steps.
 *
 * A Webinar lead IS a registration — Adam, 2026-09-18. That is the Registered
 * step above, and it is what the Channels tab counts. The rows in
 * `lead_submissions` captured on /start are a different and much smaller
 * thing: the people who filled the site form. Calling those the lane's "Lead"
 * put two meanings on one word, which is why the Channels tab's 4,042 read as
 * a bug against this lane's 3. They were both right; only one of them was
 * allowed to be called a lead.
 *
 * They keep the `lead` kind because the qualification, booking, show and win
 * steps below are all keyed off a lead row. Only the label changes.
 */
const WEBINAR_CLOSING_STEPS: readonly JourneyStep[] = CLOSING_STEPS.map(
  (step) =>
    step.kind === "lead"
      ? {
          ...step,
          label: "/start form",
          detail:
            "Site form submissions on /start. The Webinar lead is the registration above.",
        }
      : step,
);

export const CHANNEL_JOURNEYS: readonly ChannelJourney[] = [
  {
    key: "webinar",
    label: "Webinar",
    channels: ["Webinar"],
    note: "Paid ads drive registration; the webinar itself sends people to /start to book. A Webinar lead is a registration (Adam, 2026-09-18), so the Registered step is this lane's lead count and the Channels tab's thousands are the right figure. The /start form step below is site form submissions only, which is a different and much smaller thing. Registration is counted by the webinar receiver, not GA4, so the step before it is not a like-for-like denominator.",
    steps: [
      {
        key: "seen",
        kind: "reach",
        metric: "impressions",
        label: "Ad seen",
        detail: "Impressions the platform reports",
      },
      { key: "clicked", kind: "reach", metric: "clicks", label: "Clicked" },
      {
        key: "registered",
        kind: "registrations",
        label: "Registered",
        detail: "Webinar registrations",
      },
      {
        key: "page",
        kind: "page",
        paths: ["/start"],
        label: "/start",
        detail: "The booking page the webinar sends to",
      },
      ...WEBINAR_CLOSING_STEPS,
    ],
  },
  {
    key: "youtube",
    label: "YouTube",
    channels: ["YouTube"],
    steps: [
      {
        key: "seen",
        kind: "reach",
        metric: "impressions",
        label: "Video seen",
        detail: "YouTube impressions",
      },
      {
        key: "page",
        kind: "page",
        paths: ["/booking-youtube"],
        label: "/booking-youtube",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    channels: ["Instagram"],
    note: "Mike's and Anthony's person-tagged links roll up here; the landers take three fields and hand straight to a calendar, so the questions step is empty by design.",
    steps: [
      { key: "seen", kind: "reach", metric: "impressions", label: "Post seen" },
      {
        key: "page",
        kind: "page",
        paths: ["/booking-t5-socials", "/booking-ak-t5", "/booking-ig"],
        label: "Social landers",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "google-ads",
    label: "Google Ads",
    channels: ["Google Ads"],
    steps: [
      { key: "seen", kind: "reach", metric: "impressions", label: "Ad seen" },
      { key: "clicked", kind: "reach", metric: "clicks", label: "Clicked" },
      {
        key: "page",
        kind: "page",
        paths: ["/contact", "/"],
        label: "/contact + home",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    channels: ["Meta Ads", "Meta"],
    steps: [
      { key: "seen", kind: "reach", metric: "impressions", label: "Ad seen" },
      { key: "clicked", kind: "reach", metric: "clicks", label: "Clicked" },
      {
        key: "page",
        kind: "page",
        paths: ["/booking-meta"],
        label: "/booking-meta",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "website",
    label: "Website",
    channels: ["Website"],
    note: "Untagged traffic that browsed the site and then converted. There is no reach step because the site is not a placement anyone buys.",
    steps: [
      {
        key: "page",
        kind: "page",
        paths: [
          "/",
          "/contact",
          "/about",
          "/case-studies",
          "/news",
          "/pre-call-resources",
          "/book-now",
        ],
        label: "Site pages",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "newsletter",
    label: "Newsletter",
    channels: ["Newsletter", "Email"],
    steps: [
      { key: "clicked", kind: "reach", metric: "clicks", label: "Clicked" },
      {
        key: "page",
        kind: "page",
        paths: ["/", "/newsletter", "/vending-route-blueprint"],
        label: "Landing pages",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    channels: ["LinkedIn"],
    steps: [
      { key: "seen", kind: "reach", metric: "impressions", label: "Post seen" },
      {
        key: "page",
        kind: "page",
        paths: ["/booking-ak-t5", "/booking-t5-socials", "/contact"],
        label: "Landing pages",
      },
      ...CLOSING_STEPS,
    ],
  },
  {
    key: "chatbot",
    label: "Chatbot",
    channels: ["Chatbot"],
    note: "The on-site setter captures mid-conversation, so there is no landing page of its own and no page step.",
    steps: CLOSING_STEPS,
  },
  {
    key: "instagram-dm",
    label: "Instagram DM",
    channels: ["Instagram DM"],
    note: "Pearl books on a GHL-hosted page, so we never see a visit. Leads onward only.",
    steps: CLOSING_STEPS,
  },
];
