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
export const HONEYPOT_FIELD = "company_website";

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

/** Query params that identify a person; stripped from the confirmed page's URL. */
export const PII_PARAMS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "name",
  "full_name",
] as const;

type QueryParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** `?first=` as a display name, or undefined when it is not a plain name. */
export function safeFirstName(params: QueryParams): string | undefined {
  const value = firstValue(params.first)?.trim().slice(0, 40);
  return value && NAME_PATTERN.test(value) ? value : undefined;
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

export const masterclassHero = {
  eyebrow: "Free live masterclass with Anthony Kolodziej",
  /** Small label over the form card. */
  formEyebrow: "Live on Zoom",
  /** The GHL form heading ("Secure Your Free Spot!"). */
  formHeading: "Secure your free spot",
  headline: "Your company can replace you. Your business can't.",
  subheadline: "Learn how to build a cash-flowing vending route in 2026",
  highlight: "can't.",
  videoCue: "Watch Anthony's story",
};

/** The four check-mark takeaways from the GHL registration page, verbatim. */
export const masterclassTakeaways = [
  "The real decisions, real timeline, and real obstacles vending operators navigate to build successful routes.",
  "The three-pillar system that makes this repeatable - the framework every operator uses, whether they're building one machine or scaling a route.",
  "Real numbers on what's actually possible - pulled directly from Anthony and operators in the community. Not theory. Real results from real people.",
  "Clarity on whether this is right for you - can you realistically execute this? What would success look like for YOUR situation? What's the real cost of entry?",
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

export const storiesCopy = {
  eyebrow: "Real operators. Real routes.",
  heading: "People with jobs like yours",
  highlight: "jobs like yours",
  body: "Tap any story to watch it here.",
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
  eyebrow: "Is this for you?",
  /** The GHL closing headline ("Your Freedom Starts Here"). */
  heading: "Your freedom starts here",
  highlight: "freedom",
  forTitle: "This is for you if",
  notForTitle: "Skip it if",
  cta: "Save my free seat",
  ctaNote: "Free. Live on Zoom. Takes 20 seconds.",
};

/** Registration form errors. Never shows a raw service error. */
export const registrationErrorCopy = {
  consent: "Check the box so we can text you the Zoom link",
  failed: "We could not save your seat just now. Please try again in a minute.",
};

/** The Vidalytics welcome video from the GHL thank-you page (embed id read off that page 2026-09-30). */
export const CONFIRMED_VIDEO_EMBED_ID = "Uu01XEF76UJIUSOJ";

export const confirmedCopy = {
  eyebrow: "Seat confirmed",
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
};

/**
 * Shown by both masterclass forms when the limiter refuses. It also refuses
 * during a limiter outage (fail closed), so it must not say "too many".
 */
export const MASTERCLASS_BUSY_MESSAGE =
  "We couldn't save that just now. Please try again in a few minutes.";

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
  signoff: "Anthony",
  photoAlt: "Anthony Kolodziej with his son",
};

export const fitFor = [
  "You want income you own, not another job",
  "You can give it 5–10 hours a week",
  "You want something real and built to last",
] as const;

export const notFitFor = [
  "You want overnight results with zero work",
  "You won't put in real effort for the first 90 days",
] as const;

export const SENDER_EMAIL = "anthony@webinar.vendingpreneurs.co";

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
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vendingpreneurs//Masterclass//EN",
    "BEGIN:VEVENT",
    `UID:masterclass-${stamp(start)}@vendingpreneurs.com`,
    `DTSTAMP:${stamp(start)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return {
    google,
    outlook,
    ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
  };
}
