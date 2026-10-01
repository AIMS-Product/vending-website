/**
 * The team briefing on /masterclass-review (Adam, 2026-09-30): what was built,
 * the journey a registrant takes, how it was tested, and what the team must
 * decide before the next webinar runs on these pages. Internal, noindex.
 * Every figure here is from the build log of 2026-09-30; update it, never guess.
 */

/** A decision is one line, or a lead + one entry per item + a closing ask. */
export type ReviewDecision =
  | string
  | {
      lead: string;
      items: readonly { name: string; text: string }[];
      tail: string;
    };

export const reportCopy = {
  journeyHeading: "The journey, start to finish",
  journeyIntro:
    "This is the path every registrant takes. Steps marked GHL still run inside GoHighLevel exactly as they do today; everything else now lives on vendingpreneurs.com.",
  journey: [
    {
      who: "Site",
      step: "Ad, email or link",
      detail:
        "Visitor lands on vendingpreneurs.com/masterclass. Ad tracking (UTMs) is captured.",
    },
    {
      who: "Site",
      step: "Registers",
      detail:
        "Name, email, US/Canada mobile, text consent. Bots and repeat spam are blocked.",
    },
    {
      who: "GHL",
      step: "Contact + workflow",
      detail:
        "Same GHL registration workflow as today: event tag, opportunity, confirmation text and email, reminder sequences.",
    },
    {
      who: "GHL",
      step: "Zoom + Close",
      detail:
        "Zoom registration and personal join link (about 8 seconds), Close lead (about 10 seconds).",
    },
    {
      who: "Site",
      step: "Confirmation page",
      detail:
        "Countdown, add-to-calendar, 3 intake questions saved to the contact, the Playbook offer, member stories.",
    },
    {
      who: "Site",
      step: "Playbook offer ($67)",
      detail:
        "Offer page on our site; checkout and payment stay in GHL (Stripe), name prefilled.",
    },
    {
      who: "GHL",
      step: "Reminders and live room",
      detail:
        "Reminder emails and texts, Anthony's voice drop, the live Zoom room. Unchanged.",
    },
    {
      who: "Site",
      step: "Replay pages",
      detail:
        "Registered but missed it, attended but did not book, Meta retargeting, advisory team. Each has the replay and its expiry; three have the booking path (advisory goes through the advisory team).",
    },
    {
      who: "Site",
      step: "Booking",
      detail:
        "Advisory call booking (Calendly or the GHL scoring form), exactly as today.",
    },
  ],
  testedHeading: "How it was tested",
  tested: [
    {
      figure: "4",
      label: "end-to-end test registrations",
      detail:
        "Two on the live site. Each one checked in GHL, Zoom, Close, the Google Sheet, Meta and the inbox, then deleted everywhere.",
    },
    {
      figure: "176",
      label: "AI design inspectors and fixers, 8 rounds",
      detail:
        "Every page on desktop and phone, side by side with the GHL original, plus a QA tester trying to break every link, form and embed in each round. 152 findings in the first round; every serious one was fixed and re-checked the next round, then three more full passes re-inspected everything from scratch.",
    },
    {
      figure: "2",
      label: "three-way code and security reviews",
      detail:
        "Independent reviewers on every change that writes to GoHighLevel. 23 confirmed issues (6 of them high severity), all fixed before launch.",
    },
    {
      figure: "3,600+",
      label: "automated checks passing",
      detail:
        "Run on every change: type checks, linting and the full test suite of the site.",
    },
  ],
  timingsHeading: "Measured on production",
  timings: [
    { system: "GHL contact, tags, tracking", time: "instant" },
    { system: "Confirmation text", time: "+6 s" },
    { system: "Confirmation email", time: "+7 s" },
    { system: "Zoom registration + join link", time: "+8 s" },
    { system: "Close lead", time: "+10 s" },
    { system: "Meta registration event", time: "+4 s" },
  ],
  betterHeading: "What is better than the GHL version",
  better: [
    "The date, countdown and Anthony's numbers read live from GHL, so the weekly rollover updates every page.",
    "Free Google, Apple and Outlook calendar buttons replace the paid AddEvent widget.",
    "The intake answers save to the contact and never overwrite earlier answers.",
    "Replay countdowns set themselves from the next webinar date: no weekly hand edits.",
    "The webinar dashboard now shows Playbook checkouts, purchases and revenue per webinar.",
    "Our own domain, tracking and design, instead of a GHL funnel subdomain.",
  ],
  decisionsHeading: "Decisions before we swap",
  decisions: [
    "Playbook bonuses: the page shows a 5-item bonus stack and 9 bonuses. Which are actually delivered?",
    {
      lead: "Member figures conflict across pages.",
      items: [
        {
          name: "Anthony",
          text: 'Appears in several versions (locations, machines, monthly revenue) and as "120k$". On /playbook alone: "We have 45 locations, 77 machines, and did $98,000 last month" (opportunity quote card), "to go from laid off to 98k/mo with 45 locations" (opportunity checklist), "Former real estate entrepreneur, Anthony, followed this same process to scale to 45 locations and 79 machines, generating over 100k in revenue in one month" (story card), and "exceed 120k$ in monthly revenue" (hero H1). Background reads "laid off" in the checklist and "Former real estate entrepreneur" in the story card.',
        },
        {
          name: "Mike Hoffmann",
          text: 'On /playbook: "How Mike generates 100k/mo from 102 machines" (opportunity checklist) vs "150+ Machines Generating 200k/Month" (host section H2).',
        },
        {
          name: "Michael D",
          text: '"$650K Annual Revenue" and "18 machines" on his /masterclass card (the ticker reads "$650K annual revenue"), "$600K/Yr" burned into his video thumbnail, and "18 locations | ~$54K/mo" on the replay pages.',
        },
        {
          name: "Joe",
          text: '"15+ Machines" in his video thumbnail, "$5,500 Monthly Revenue" and "15 locations" on his /masterclass card, "15 locations | ~$5.5K/mo" on the replay pages.',
        },
        {
          name: "Matt Morrison",
          text: '"$43K Monthly Revenue" on his /masterclass card and in the ticker, "$7K/MO" in his video thumbnail.',
        },
      ],
      tail: "Kody and legal to approve one set per member and the formatting.",
    },
    "Playbook hero reads '120K$'. Approve a format-only change to '$120K' (figure unchanged).",
    '"Show up live" bonuses on the confirmation page: the GHL block is live word for word, except that "tonight" reads "on Tuesday" (the session\'s weekday) until the day of the session. Pending owner confirmation that the bonuses are still offered.',
    "Who hosts each replay (Mike or Anthony) for the photos and labels.",
    "GHL scoring form styling (teal button) is set in the GHL form builder.",
    'Vidalytics player settings ("Pearl VP Admin" label, unmute overlay) are set in the Vidalytics account.',
    'The site banner still says "1 open seat left in the September cohort".',
  ] as readonly ReviewDecision[],
  swapHeading: "Swap plan for the next webinar",
  swap: [
    "Team reviews today and sends notes to Adam.",
    "Fixes and the decisions above go in; a final check runs on the live site.",
    "Paid ads point to vendingpreneurs.com/masterclass (one ad set first if we want a split test).",
    "Links in GHL emails and texts move to the site pages (playbook, replays).",
    "The GHL pages stay up as a fallback; nothing in GHL is turned off until two webinars run clean.",
  ],
} as const;
