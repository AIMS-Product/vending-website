/**
 * The webinar registration funnel, rebuilt on the site's own UI next to the
 * GoHighLevel pages it copies (Adam, 2026-09-30). The GHL pages stay live and
 * untouched; this runs beside them so the two can be compared on opt-in rate.
 *
 * Every income figure below is the wording already approved on the GHL pages
 * (webinar.vendingpreneurs.com/webinar-registration, 2026-09-30). Shortened
 * around, never reworded.
 */

export const MASTERCLASS_PATH = "/masterclass";
export const MASTERCLASS_CONFIRMED_PATH = "/masterclass-confirmed";

/** The GHL form every registration variant submits to, and its location. */
export const GHL_REGISTRATION_FORM_ID = "TsHS6bjzHkHakUa1ULxu";
export const GHL_LOCATION_ID = "Qxw5m2PoOz2MCr6m2v0M";

/** GHL custom values the GHL pages read; the weekly rollover updates them. */
export const GHL_VALUE_NAMES = {
  dateTime: "Webinar Date n Time",
  locations: "Anthony Locations",
  machines: "Anthony Machines",
  revenue: "Anthony Revenue",
} as const;

/** Hidden from people; a bot that fills it gets the thank-you page and nothing is written. */
export const HONEYPOT_FIELD = "mc_hp_field";

/** Ad-click parameters carried from the landing URL into the submission. */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

/** Same rule as the registration form: letters, spaces, apostrophes, hyphens. */
export const NAME_PATTERN = /^[\p{L}' -]+$/u;

/**
 * Query params that identify a person; stripped from the funnel pages' URLs
 * (StripPiiParams). `contact_id` is the GHL contact id GHL links append: no
 * page reads it from the URL, and left in place it reaches GA page_location
 * and referrers.
 */
export const PII_PARAMS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "name",
  "full_name",
  "contact_id",
] as const;

type QueryParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The registration form's first-name rule (letters, spaces, apostrophes,
 * hyphens, at most 40), so "Mary Jo" and long hyphenated names survive. At
 * most three words: no real first name is longer, and a crafted link cannot
 * print a sentence in the H1.
 */
const FIRST_NAME = /^(?=.{1,40}$)[\p{L}'-]+(?: [\p{L}'-]+){0,2}$/u;

/** `first` collapsed to single spaces and trimmed. */
function normalizeFirst(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/**
 * Whether a raw `?first=` value is a plain name (the rule safeFirstName
 * uses). Anything else, like an email or a phone number, is PII to strip.
 */
export function isSafeFirstName(value: string): boolean {
  const name = normalizeFirst(value);
  return name !== "" && FIRST_NAME.test(name);
}

/**
 * `?first=` as a display name, or undefined when it is not a plain name.
 * Spaces are collapsed and its first letter is capitalised ("adam" reads
 * "Adam").
 */
export function safeFirstName(params: QueryParams): string | undefined {
  const name = normalizeFirst(firstValue(params.first) ?? "");
  if (!isSafeFirstName(name)) return undefined;
  return name.charAt(0).toLocaleUpperCase("en-US") + name.slice(1);
}

/**
 * `href` without contact params (PII_PARAMS, plus `first` when it is not a
 * plain name), or null when there is nothing to remove.
 */
export function stripPiiFromUrl(href: string): string | null {
  const url = new URL(href);
  let changed = false;
  for (const key of PII_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  const first = url.searchParams.getAll("first");
  if (first.length && !first.every(isSafeFirstName)) {
    url.searchParams.delete("first");
    changed = true;
  }
  return changed ? url.href : null;
}

/**
 * What the confirmed page forwards to the Playbook offer: the ad attribution,
 * plus the validated first name as `first_name`. Any other name or contact
 * field in the URL is dropped, never forwarded.
 */
export function confirmedPlaybookParams(params: QueryParams): QueryParams {
  const out: QueryParams = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = firstValue(params[key]);
    if (value) out[key] = value.slice(0, 200);
  }
  const first = safeFirstName(params);
  if (first) out.first_name = first;
  return out;
}

/** 60 minutes of training plus 15 of live Q&A, per the confirmation email. */
export const MASTERCLASS_MINUTES = 75;

/**
 * How long after the start the room counts as live. Longer than the scheduled
 * 75 minutes because the Q&A runs over; after it the GHL date is stale until
 * the weekly rollover writes the next one.
 */
export const MASTERCLASS_LIVE_WINDOW_MINUTES = 90;

export type MasterclassPhase = "upcoming" | "live" | "ended";

/**
 * Where `now` sits against the GHL start. An unknown or unparsed start counts
 * as upcoming, so the page shows the GHL text as written.
 */
export function masterclassPhase(
  now: number,
  startsAt: string | null | undefined,
): MasterclassPhase {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN;
  if (Number.isNaN(start) || now < start) return "upcoming";
  return now < start + MASTERCLASS_LIVE_WINDOW_MINUTES * 60_000
    ? "live"
    : "ended";
}

/** The ISO instant the live window closes, or null without a start. */
export function masterclassLiveEnd(startsAt: string | null): string | null {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN;
  if (Number.isNaN(start)) return null;
  return new Date(
    start + MASTERCLASS_LIVE_WINDOW_MINUTES * 60_000,
  ).toISOString();
}

/** Shown in place of the date line once the start has passed. */
export const eventPhaseCopy = {
  live: "Live now",
  ended: "Next session date coming soon",
} as const;

export const masterclassHero = {
  eyebrow: "Free live masterclass with Anthony Kolodziej",
  /** Small label over the form card. */
  formEyebrow: "Live on Zoom",
  /** The GHL form heading ("Secure Your Free Spot!"). */
  formHeading: "Secure your free spot",
  headline: "Your company can replace you. Your business can't.",
  subheadline: "Learn how to build a cash-flowing vending route in 2026",
  /** Highlighted with a left-to-right sweep (Adam, 2026-10-01). */
  highlight: "Your business can't.",
  videoCue: "Watch Anthony's story",
  /** Beside the form from lg, under it on phones (the submit stays on the first screen). */
  proofLead: "Active operator",
  /** Under the phone field. True to the GHL texts: link at T-15m and T-0. */
  phoneHint: "We text your Zoom link and a 15-minute reminder.",
  /** Sticky bottom bar (phones and desktop, once past the hero). */
  stickyCta: "Save my free seat",
};

/** Black top bar, the homepage CohortBanner's look (Adam, 2026-10-01). */
export const countdownBanner = {
  lead: "Live masterclass starts in",
  cta: "Save your seat",
};

const STICKY_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * The sticky bar's line: "Tue Oct 6 · 7:30 PM CT · Free" before the start,
 * "Free live masterclass" once it has passed or with no date. `short` is
 * the two-line phone form ("Tue Oct 6\n7:30 PM CT").
 */
export function stickyEventLine(
  startsAt: string | null | undefined,
  now: number,
  short = false,
): string {
  const time = startsAt ? Date.parse(startsAt) : NaN;
  if (Number.isNaN(time) || time <= now)
    return short ? "Free live\nmasterclass" : "Free live masterclass";
  const part = (type: string) =>
    STICKY_DATE.formatToParts(time).find((p) => p.type === type)?.value ?? "";
  const clock = `${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
  const day = `${part("weekday")} ${part("month")} ${part("day")}`;
  // Phones: two short lines beside the button.
  return short ? `${day}\n${clock} CT` : `${day} · ${clock} CT · Free`;
}

/**
 * Ad-matched hero variants, picked by `?angle=` on the ad's URL. The default
 * (no or unknown angle) is the approved ownership headline above. Each
 * variant keeps the rest of the page identical so a split test isolates the
 * hero. Copy from the 2026-10-02 CRO review (Liana), trimmed.
 */
export const masterclassHeroAngles = {
  capital: {
    headline: "Invest in a vending route, not just a machine.",
    highlight: "not just a machine.",
    subheadline:
      "See the startup costs, locations and weekly work to know before you invest",
  },
  location: {
    headline: "Don't buy the vending machine yet.",
    highlight: "yet.",
    subheadline:
      "Learn why the location, its foot traffic and the agreement should decide the machine you buy, not the other way around",
  },
  // v1, v3 and v5 mirror the GHL landing pages webinar.vendingpreneurs.com/v1,
  // /v3 and /v5 (read live 2026-10-07): headline, intro, bullets and both fit
  // lists verbatim, so Liana's 50/50 test compares the page, not new copy.
  // Everything else (form, numbers, host, member stories) stays identical.
  // GHL's own member quotes are not carried over: Kody has not approved them,
  // and /v1's "John" card repeats Shannon R.'s quote word for word.
  v1: {
    headline: "Your capital should have a job",
    highlight: "should have a job",
    subheadline: "Learn how to build a cash-flowing vending route in 2026",
    intro:
      "If you already have income and are looking for another place to grow it, modern vending gives you a tangible business to evaluate: real locations, real products, real customers, and a route you can improve over time.",
    takeaways: [
      "Why vending can be a lower-barrier asset than real estate, franchises, laundromats, or buying a business outright",
      "What to understand before putting money into a machine or location",
      "How location quality, product mix, service, and owner discipline affect the numbers",
      "How to decide if vending fits your time, capital, and goals",
    ],
    fitFor: [
      "You already have income and want another place to grow it",
      "You want a tangible business, not only another paper asset",
      "You want to evaluate the model before deploying capital",
      "You understand this is not a get-rich-quick scheme",
    ],
    notFitFor: [
      "You want guaranteed income",
      "You want a no-money startup",
      "You want to buy a machine and hope it performs",
      "You are not willing to evaluate location quality, service, and route economics",
    ],
  },
  v3: {
    headline:
      "Build something your family can own, without losing every evening to work.",
    highlight: "your family can own,",
    subheadline: "Learn how to build a cash-flowing vending route in 2026",
    intro:
      "For many people, vending is not just about another income stream. It is a way to start building more calendar control while creating a business the household can understand, help operate, and grow together.",
    takeaways: [
      "How families start while one or both parents are still employed",
      "What the owner does in the early stage before the route is systemized",
      "How kids can learn discipline, money, service, and ownership by seeing the business up close",
      "What has to happen before the route can give time back instead of taking more of it",
      "How to think about vending as a household-owned asset, not just another side project",
    ],
    fitFor: [
      "You want more time with your family over the long term",
      "You want your kids to see business ownership up close",
      "You want to build something the household understands",
      "You want an asset the family can help with in age-appropriate ways",
      "You want more than another job or another side hustle",
    ],
    notFitFor: [
      "You want a business that requires no planning",
      "You want income without learning the route first",
      "You expect the business to be systemized before it is built",
      "You do not want family or spouse alignment before committing time and capital",
    ],
  },
  v5: {
    headline: "A strong income can still depend on one source.",
    highlight: "one source.",
    subheadline: "Learn how to build a cash-flowing vending route in 2026",
    intro:
      "The paycheck can be healthy and still leave the whole household tied to one employer, one role, or one business. This training shows how modern vending works as a route-based business you can evaluate before you start.",
    takeaways: [
      "How Anthony started thinking differently after job uncertainty",
      "Why vending is not about buying a machine and hoping",
      "How a real route is built around locations, products, service, and numbers",
      "How to evaluate whether this model fits your life before you start",
    ],
    fitFor: [
      "You have a good income but want more ownership",
      "You do not want one employer carrying the whole plan",
      "You want to understand vending before putting capital into it",
      "You want a real business, not another online trend",
    ],
    notFitFor: [
      "You want a guarantee",
      "You want a shortcut",
      "You want a no-work asset",
      "You want to avoid the real questions around location, capital, inventory, service, and owner involvement",
    ],
  },
} as const satisfies Record<string, AngleCopy>;

type AngleCopy = {
  headline: string;
  highlight: string;
  subheadline: string;
  intro?: string;
  takeaways?: readonly string[];
  fitFor?: readonly string[];
  notFitFor?: readonly string[];
};

export type HeroAngle = keyof typeof masterclassHeroAngles;

/** The known angle for `?angle=`, or null for missing/unknown (the default page). */
export function knownAngle(angle: string | null | undefined): HeroAngle | null {
  return angle && Object.hasOwn(masterclassHeroAngles, angle)
    ? (angle as HeroAngle)
    : null;
}

/** The hero copy for an ad angle; anything unrecognised gets the default. */
export function heroForAngle(angle: string | null | undefined) {
  const key = knownAngle(angle);
  return key
    ? { ...masterclassHero, ...masterclassHeroAngles[key] }
    : masterclassHero;
}

/**
 * The angle's message beyond the hero: intro line, "On the call" bullets and
 * both fit lists. Each falls back to the default page's copy, so a
 * headline-only angle (capital, location) changes nothing else.
 */
export function pageForAngle(angle: string | null | undefined): {
  intro: string | null;
  takeaways: readonly string[];
  fitFor: readonly string[];
  notFitFor: readonly string[];
} {
  const key = knownAngle(angle);
  const v: Partial<AngleCopy> = key ? masterclassHeroAngles[key] : {};
  return {
    intro: v.intro ?? null,
    takeaways: v.takeaways ?? masterclassTakeaways,
    fitFor: v.fitFor ?? fitFor,
    notFitFor: v.notFitFor ?? notFitFor,
  };
}

/**
 * GHL's `utm_term` for a registration from an angle page, so the board can
 * split opt-in and show rate by version.
 */
export function angleTerm(angle: string | null | undefined): string | null {
  const key = knownAngle(angle);
  return key ? `angle-${key}` : null;
}

/**
 * The angle version overrides any `utm_term` on the URL. Meta appends its own
 * `utm_term` (the ad set id, already carried in `utm_medium`) to every click,
 * so letting the URL win would drop the version on every paid visit.
 */
export function withAngleTerm(
  attribution: Record<string, string>,
  angle: string | null | undefined,
): Record<string, string> {
  const term = angleTerm(angle);
  return term ? { ...attribution, utm_term: term } : attribution;
}

/**
 * What the call covers. Team wording (2026-10-05), only the bold/body
 * separator normalised to " - ". Text before " - " renders bold.
 */
export const masterclassTakeaways = [
  "How you can become your own boss - how you don't need a ton of capital like Real Estate for a cash flowing asset such as Vending. Also, how you don't need any Vending experience to get started.",
  "How Vending Routes work - what you own, what it costs to start, and what multiples you can get if you want to sell it.",
  "The three-pillar system behind every route - with real numbers from Anthony and members. Not theory.",
  "Whether it fits your life - the capital, the weekly hours and the work involved, so you can decide before you spend a dollar.",
] as const;

export const SMS_CONSENT_TEXT =
  "By checking this box, I consent to receive marketing and promotional messages from Vendingpreneurs. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.";

export const hostCopy = {
  eyebrow: "Your host, Anthony Kolodziej",
  line: "Laid off. Built a route instead.",
  highlight: "Built a route instead.",
  videoTitle: "How Anthony built a $102K/month vending business",
  statLabels: {
    locations: "Locations",
    machines: "Machines",
    revenue: "Monthly revenue",
  },
  footnote: "Anthony's verified numbers.",
};

/** Anthony's own case-study video; also left out of the member grid below it. */
export const ANTHONY_VIDEO_ID = "fsRX7K_Hg08";

/**
 * Candid photos of Anthony from the GHL registration page. The video uses its
 * own still because YouTube's thumbnail burns in a figure that disagrees with
 * the verified stats beside it; his face sits left of the centred play disc.
 */
export const hostVideoPoster = "/images/masterclass/anthony-at-machine.jpg";

/**
 * The closing pair, the portrait shot wider. The at-machine shot is the host
 * video's poster, so it is not repeated here; the GHL kitchen and hallway
 * candids only exist at ~400px wide (soft on 2x screens). `position` keeps
 * Anthony in each crop.
 */
export const hostCandids = [
  {
    src: "/images/masterclass/anthony-pointing-at-machine.jpg",
    alt: "Anthony pointing at a stocked smart vending machine on location",
    width: 1080,
    height: 1350,
    position: "object-[50%_8%] sm:object-center",
  },
  {
    src: "/images/masterclass/anthony-three-machines.jpg",
    alt: "Anthony, arms crossed, in front of a stocked vending machine",
    width: 1200,
    height: 628,
    position: "object-center",
  },
] as const;

export const storiesCopy = {
  eyebrow: "Real operators. Real routes.",
  heading: "People with jobs like yours",
  highlight: "jobs like yours",
  /** After the member count; the cards are images only (no player). */
  body: "members, in their own words.",
  /** Stories shown before "more"; the rest open in place, never on a new page. */
  initial: 8,
  /** Below md, fewer cards before "more", so the second CTA is not 3,000px away. */
  initialMobile: 3,
  more: (n: number) => `Show ${n} more stories`,
};

/**
 * The approved disclaimer from applyFooter, less its "$5,000-$60,000" sentence:
 * that sentence covers the apply page's headline, which this page does not make.
 */
export const MASTERCLASS_DISCLAIMER =
  "Earnings may vary and are not guaranteed. Outcomes depend on effort, market, and execution.";

export const fitCopy = {
  /** Decision support, not the GHL "Your freedom starts here" (CRO review 2026-10-02). */
  heading: "Know if vending belongs in your plans",
  highlight: "your plans",
  subheading:
    "Leave knowing the capital, locations, equipment and weekly work behind a route. If it fits, you'll know the next step. If not, you'll know before you spend a dollar.",
  forTitle: "This is for you if",
  notForTitle: "Skip it if",
  cta: "Save my free seat",
  ctaNote: "Free. Live on Zoom. Takes 20 seconds.",
};

/** Registration form errors. Never shows a raw service error. */
export const registrationErrorCopy = {
  consent: "Check the box so we can text you the Zoom link",
  failed: "We could not save your seat just now. Please try again in a minute.",
  /** The GHL date has passed and the rollover has not written the next one. */
  nextDatePending:
    "You're on the list. The next date is being set, and we'll send it to you as soon as it is.",
};

/** The Vidalytics welcome video from the GHL thank-you page (embed id read off that page 2026-09-30). */
export const CONFIRMED_VIDEO_EMBED_ID = "Uu01XEF76UJIUSOJ";

/**
 * Still behind the welcome video's play button. Vidalytics only serves a
 * 480px captioned thumbnail, so this is a clean candid of Anthony instead.
 */
export const CONFIRMED_VIDEO_POSTER =
  "/images/masterclass/anthony-at-machine.jpg";

export const confirmedCopy = {
  eyebrow: "Seat confirmed",
  /** Every site registrant ticked SMS consent; GHL texts the link at T-15m and T-0. */
  zoomTextLine: "We'll also text it to you before we go live.",
  calendarTitle: "Vendingpreneurs Live Masterclass with Anthony",
  steps: [
    { n: "01", title: "Find your Zoom link" },
    {
      n: "02",
      title: "Hit reply to Anthony",
      body: "Tell him what made you sign up. He reads every response, and it shapes the live Q&A.",
    },
  ],
  storiesEyebrow: "While you wait",
  storiesHeading: "How they did it",
  /** Built only from the on-page step titles and calendar line above. */
  metaDescription:
    "Seat confirmed for the Vendingpreneurs Live Masterclass with Anthony. Find your Zoom link, add it to your calendar now, and hit reply to Anthony.",
};

/**
 * The GHL thank-you page's "Show up live" block, transcribed verbatim from its
 * image (2026-09-30). The heading splits so the closing phrase can highlight.
 */
export const showUpLiveCopy = {
  eyebrow: "Show up live",
  // Non-breaking spaces keep the dash with "you" and the 3 with its noun.
  heading: "If you want to own something no one can take from you\u00a0— ",
  /** "that alone is reason enough.", in two blocks so it wraps cleanly. */
  highlight: ["that alone is", "reason enough."],
  bodyLead: "Show up live tonight and you'll walk away with ",
  bodyStrong: "3\u00a0exclusive bonuses",
  bodyTail: " you won't find in the replay.",
  bonuses: [
    {
      title: "Fast-action bonus",
      body: "Exclusive discount — for live attendees who act tonight only",
    },
    { title: "Exclusive resource", body: "You won't find this anywhere else" },
    { title: "Special guide", body: "Fast-track your success from day one" },
  ],
  closing: "These won't be in the replay.",
} as const;

const chicagoDay = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/**
 * The GHL block says "tonight", which is only true on the day itself. Any
 * earlier day reads "on {Weekday}" from the event start, in the event's time
 * zone. An unknown start keeps the GHL word.
 */
export function liveDayWord(now: number, startsAt: string | null): string {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return "tonight";
  if (chicagoDay(start) === chicagoDay(new Date(now))) return "tonight";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(start);
  return `on ${weekday}`;
}

/** `text` with its one "tonight" swapped for `liveDayWord`; nothing else changes. */
export function withLiveDay(text: string, day: string): string {
  return text.replace("tonight", day);
}

/**
 * Shown by both masterclass forms when the limiter refuses. It also refuses
 * during a limiter outage (fail closed), so it must not say "too many".
 */
export const MASTERCLASS_BUSY_MESSAGE =
  "We couldn't save that right now. Please try again later.";

/**
 * The GHL "Webinar Intake Form" (nnne5vuyx5sLjhqneIFg) from the GHL thank-you
 * page. Option text is the GHL picklist value, written to the contact as is:
 * never reword an option, or GHL stores a value its own field does not offer.
 */
export const intakeCopy = {
  eyebrow: "Two minutes",
  heading: "We like to meet you where you're at.",
  body: "Answer these questions so we can build a few sections of the masterclass around you.",
  questions: [
    {
      name: "situation",
      legend: "What best describes where you're at right now?",
      options: [
        "I have a full-time job and want to build side income",
        "I thought about starting a vending business but never took action",
        "I already have some kind of side hustle or small business, but it didn't work out",
        "I'm not working right now and want to build something of my own from scratch",
      ],
    },
    {
      name: "timeline",
      legend: "How soon do you want to get started?",
      options: [
        "Right now",
        "Next two weeks",
        "Within 30 days",
        "In the next two months",
        "Three months or longer",
      ],
    },
    {
      name: "income",
      legend: "What is your current annual household income?",
      options: [
        "Less than $30,000",
        "$31,000 - $55,000",
        "$56,000 - $90,000",
        "$91,000 - $150,000",
        "More than $151,000",
      ],
    },
  ],
  submit: "Send my answers",
  pending: "Sending…",
  required: "Pick one",
  saved: "Got it, thanks. We will use your answers to shape the masterclass.",
  failed:
    "We could not save your answers just now. Please try again in a minute.",
  expired:
    "This page has timed out. Your seat is still saved; your answers just could not be linked to it.",
} as const;

/**
 * What the masterclass covers, in Anthony's words from the GHL confirmation
 * email ("You're in!", workflow "1. New Lead > Form Submission Webinar",
 * read 2026-09-30). Reuse, never reword.
 */
export const coverCopy = {
  eyebrow: "On the live call",
  heading: "What we'll cover",
  topics: [
    "The mistake that costs new operators months",
    "How I judge a location before buying equipment",
    "Whether this actually fits your schedule and goals",
  ],
  quote:
    "I'm not trying to convince you vending is for everyone. I just want to give you enough to decide for yourself.",
  /** The host label, so the quote is not credited to a bare first name. */
  signoff: hostCopy.eyebrow,
  photoAlt: "Anthony Kolodziej with his son",
};

export const fitFor = [
  "You want to build something you own, not another job or gig",
  "You have savings, income, credit or financing to fund a route",
  "You can give it 5–10 hours a week",
  "You'll check a location before you buy a machine",
] as const;

export const notFitFor = [
  "You need vending to pay you right away",
  "You want to start with little or no capital",
  "You expect it to be fully passive from day one",
  "You won't put in real effort for the first 90 days",
] as const;

export const SENDER_EMAIL = "anthony@webinar.vendingpreneurs.co";

/** The #watch band's heading: the hero's "watch" link moves focus here. */
export const WATCH_HEADING_ID = "mc-watch-heading";

/** Accessible name of the live countdown on /masterclass and /masterclass-confirmed. */
export const COUNTDOWN_LABEL = "Time until the masterclass starts";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Reads the GHL date value ("October 6, 2026 Tuesday at 7:30 PM CDT",
 * "September 1, 2026 at 12 PM CST") as an instant in Central Time.
 *
 * The zone suffix is ignored on purpose: the team has written "CST" in
 * September, so the real America/Chicago offset on that date decides.
 * Returns null when the text does not parse; the page then shows the text
 * and no countdown rather than a wrong one.
 */
export function parseWebinarStart(text: string): Date | null {
  const match =
    /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\D*?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(
      text,
    );
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour12 = Number(match[4]) % 12;
  const hour = match[6].toUpperCase() === "PM" ? hour12 + 12 : hour12;
  const minute = Number(match[5] ?? 0);
  for (const offsetHours of [5, 6]) {
    const candidate = new Date(
      Date.UTC(year, month, day, hour + offsetHours, minute),
    );
    if (chicagoHour(candidate) === hour) return candidate;
  }
  return null;
}

export function chicagoHour(date: Date): number {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(text);
}

type CalendarEvent = {
  title: string;
  details: string;
  start: Date;
  minutes: number;
};

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Where the Apple / iCal button points: a real text/calendar response, not a data: URI. */
export const MASTERCLASS_ICS_PATH = "/masterclass/event.ics";

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
const icsText = (text: string) =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/**
 * RFC 5545 section 3.1: a content line longer than 75 octets continues on the
 * next line after CRLF and one space. Counted in UTF-8 bytes, never splitting a
 * character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines spend one of their 75 octets on the leading space.
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Shown as the event's location; the personal Zoom link only goes by email. */
export const MASTERCLASS_ICS_LOCATION =
  "Zoom (link in your confirmation email)";

/**
 * The event as an .ics file. DTSTAMP is when the file was made (`now`), as
 * RFC 5545 requires, not the start time.
 */
export function calendarIcs(
  { title, details, start, minutes }: CalendarEvent,
  now: Date = new Date(),
) {
  const end = new Date(start.getTime() + minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vendingpreneurs//Masterclass//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:masterclass-${stamp(start)}@vendingpreneurs.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(details)}`,
    `LOCATION:${icsText(MASTERCLASS_ICS_LOCATION)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(foldIcsLine)
    .join("\r\n")
    .concat("\r\n");
}

/** Free add-to-calendar links, replacing the paid AddEvent embed. */
export function calendarLinks({
  title,
  details,
  start,
  minutes,
}: CalendarEvent) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams(
    {
      action: "TEMPLATE",
      text: title,
      dates: `${stamp(start)}/${stamp(end)}`,
      details,
    },
  )}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams(
    {
      subject: title,
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      body: details,
      path: "/calendar/action/compose",
      rru: "addevent",
    },
  )}`;
  return { google, outlook, ics: MASTERCLASS_ICS_PATH };
}

/** The confirmation-page event, shared by the calendar links and the .ics route. */
export const masterclassCalendarEvent = (start: Date): CalendarEvent => ({
  title: confirmedCopy.calendarTitle,
  details: `Your personal Zoom link is in the confirmation email from ${SENDER_EMAIL} (check spam)`,
  start,
  minutes: MASTERCLASS_MINUTES,
});

/**
 * A member card's "Was:" line, short: the text before any "(" or ";" detail
 * ("Blue-collar worker (Air Force, ...); ran a ..." -> "Blue-collar worker").
 * The case-study article keeps the full field (Adam, 2026-10-01).
 */
export function shortOccupation(text: string): string {
  const cut = text.search(/\s*[(;]/);
  const short = (cut > 0 ? text.slice(0, cut) : text).trim();
  return short || text.trim();
}
