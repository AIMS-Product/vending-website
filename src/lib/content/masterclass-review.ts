/**
 * The team walkthrough for the site-built webinar funnel (Adam, 2026-09-30):
 * everyone registers once, follows the flow end to end, and signs off before
 * paid traffic moves off the GHL pages. Internal, unlinked, noindex.
 */

export const REVIEW_UTM =
  "utm_source=team-review&utm_medium=internal&utm_campaign=site-funnel-review";

export const reviewCopy = {
  eyebrow: "Team review",
  heading: "The webinar funnel, on our own site",
  intro:
    "Webinar registration now runs on vendingpreneurs.com. GoHighLevel still sends every text and email, through the exact same workflow as today. Nothing has been turned off: the GHL pages, ads and sequences all run as before until the team signs off.",
  stepsHeading: "Walk through it (5 minutes)",
  steps: [
    {
      title: "Register",
      body: "Open the registration page and sign up with your real name, email and mobile. Use the button below, so your test is labelled as a team review.",
      cta: {
        label: "Open the registration page",
        href: `/masterclass?${REVIEW_UTM}`,
      },
    },
    {
      title: "Check the confirmation page",
      body: "You land on your confirmation page: your name, the live countdown, add-to-calendar buttons (try one), what the call covers and member stories that play in place.",
    },
    {
      title: "Check your phone and inbox (within a minute)",
      body: 'A text from Anthony confirming your seat. An email "You\'re in!" from anthony@webinar.vendingpreneurs.co. A Zoom email with your personal join link. If one is missing, check spam, then tell Adam.',
    },
    {
      title: "Compare with the GHL version",
      body: "Look at the current GHL page side by side. Don't register a second time there.",
      cta: {
        label: "Open the current GHL page",
        href: "https://webinar.vendingpreneurs.com/home",
      },
    },
    {
      title: "Send your notes",
      body: "Anything confusing, broken, slow or off-brand: send it to Adam in Slack, with a screenshot if you can.",
    },
  ],
  flowHeading: "What happens behind the form",
  flow: [
    {
      step: "vendingpreneurs.com/masterclass",
      detail: "Visitor registers. Ad tracking (UTMs) is kept.",
    },
    {
      step: "GoHighLevel contact",
      detail: "Created or matched by email, tagged, UTMs saved.",
    },
    {
      step: "Same GHL registration workflow",
      detail:
        "Event tag, opportunity, confirmation text and email, reminder sequences.",
    },
    {
      step: "Zoom",
      detail:
        "Registered for the live room; personal link saved to the contact (about 7 seconds).",
    },
    {
      step: "Close",
      detail: "Lead created in the webinar cohort (about 9 seconds).",
    },
    {
      step: "Meta",
      detail: "Registration reported to Meta for ad optimisation.",
    },
    {
      step: "Webinar dashboard",
      detail: "Counted in the room on the next refresh.",
    },
  ],
  pagesHeading: "Every page in the flow",
  pages: [
    { label: "Registration page", href: `/masterclass?${REVIEW_UTM}` },
    {
      label: "Confirmation page (preview)",
      href: "/masterclass-confirmed?first=Team",
    },
    {
      label: "Current GHL registration page",
      href: "https://webinar.vendingpreneurs.com/home",
    },
  ],
  note: "Your registration is real: you are in the next live masterclass with everyone else and will get the normal reminders. Team-review registrations are removed from Close and the reports after sign-off.",
};
