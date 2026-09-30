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

/** Ad-click parameters carried from the landing URL into the submission. */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
] as const;

/** 60 minutes of training plus 15 of live Q&A, per the confirmation email. */
export const MASTERCLASS_MINUTES = 75;

export const masterclassHero = {
  eyebrow: "Free live masterclass with Anthony Kolodziej",
  headline: "Your company can replace you. Your business can't.",
  subheadline: "Learn how to build a cash-flowing vending route in 2026",
};

export const masterclassBody =
  "One free live hour: the three-pillar system every operator uses, real numbers from real routes, and a straight answer on whether it fits your time and budget.";

export const SMS_CONSENT_TEXT =
  "By checking this box, I consent to receive marketing and promotional messages from Vendingpreneurs. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.";

export const hostCopy = {
  eyebrow: "Your host, Anthony Kolodziej",
  line: "Laid off. Built a route instead. 2.5 years later:",
  photoAlt: "Anthony Kolodziej beside one of his machines",
  statLabels: {
    locations: "Locations",
    machines: "Machines",
    revenue: "Monthly revenue",
  },
  footnote: "Anthony's verified numbers.",
};

export const operatorsCopy = {
  eyebrow: "Real operators. Real routes.",
  heading: "People with jobs like yours",
};

export const fitCopy = {
  forTitle: "This is for you if",
  notForTitle: "Skip it if",
  cta: "Save my free seat",
};

export const confirmedCopy = {
  preview:
    "Preview: this page does not register anyone yet. Live registration still runs on the GHL page.",
  eyebrow: "Seat confirmed",
  calendarTitle: "Vendingpreneurs Live Masterclass with Anthony",
  steps: [
    { n: "01", title: "Find your Zoom link" },
    {
      n: "02",
      title: "Show up live",
      body: "Three things go only to people in the room. They are not in the replay.",
    },
  ],
  videosHeading: "While you wait: how they did it",
};

export type Operator = {
  name: string;
  before: string;
  result: string;
  photo: string;
};

export const operators: readonly Operator[] = [
  {
    name: "Graham & Katie",
    before: "W2 sales couple",
    result: "16 machines grossing $36K a month",
    photo: "/images/masterclass/graham-katie.jpg",
  },
  {
    name: "Shannon R.",
    before: "Full-time W2 employee",
    result: "4 locations grossing $22K–$25K a month",
    photo: "/images/masterclass/shannon.jpg",
  },
  {
    name: "Michael D.",
    before: "Entrepreneur",
    result: "18 machines, roughly $650K gross revenue a year",
    photo: "/images/masterclass/michael.jpg",
  },
  {
    name: "Madison G.",
    before: "Stay-at-home mom",
    result: "6 locations grossing $10–12K a month",
    photo: "/images/masterclass/madison.jpg",
  },
  {
    name: "Joe N.",
    before: "Retired at 66",
    result: "15 locations, 18 machines, ~$5,500 a month",
    photo: "/images/masterclass/joe.jpg",
  },
];

export const fitFor = [
  "You want income you own, not another job",
  "You can give it 5–10 hours a week",
  "You want something real and built to last",
] as const;

export const notFitFor = [
  "You want overnight results with zero work",
  "You won't put in real effort for the first 90 days",
] as const;

/** Member stories from the GHL confirmation page, served from GHL's CDN. */
export const confirmationVideos = [
  "https://assets.cdn.filesafe.space/Qxw5m2PoOz2MCr6m2v0M/media/69dd7792caf24b80a0fee0b2.mp4",
  "https://assets.cdn.filesafe.space/Qxw5m2PoOz2MCr6m2v0M/media/69dd77a1328c56e1a049b99d.mp4",
  "https://assets.cdn.filesafe.space/Qxw5m2PoOz2MCr6m2v0M/media/69dd77e5328c56e1a049c5e9.mp4",
] as const;

export const liveOnlyBonuses = [
  {
    title: "Fast-action bonus",
    body: "An attendee-only discount, tonight only",
  },
  { title: "Exclusive resource", body: "Not available anywhere else" },
  { title: "Launch guide", body: "Fast-track your first 90 days" },
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

function chicagoHour(date: Date): number {
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
