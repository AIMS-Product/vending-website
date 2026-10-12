// Copy + data for the custom /apply landing page. Every visible string on the
// page traces back to this module (per the page/component conventions) so the
// marketing + compliance copy stays reviewable as data. This page is a Google
// Ads destination: no income figures, counts of people, time-to-result,
// "passive", "guarantee" or scarcity wording ("Unreliable claims" disapproval,
// 2026-10-10). See the Learnings line in AGENTS.md before adding any.

export type ToolIconKey = "course" | "coaching" | "discounts" | "community";

/** A run of copy that may carry emphasis, so bolded phrases stay in content. */
export type RichSegment = { text: string; strong?: boolean };

export const applyMeta = {
  title: "Apply",
  description:
    "Start your vending business with Mike's playbook, systems, coaching, and exclusive discounts. Answer a few quick questions to see if you're a fit.",
} as const;

/**
 * Reassurance line that sits under every in-page CTA button (Kody, 2026-08-10).
 * Deliberately not rendered in the header nav or the sticky bottom bar — both
 * are chrome with no room for a second line (Adam, same day).
 */
export const CTA_TRUST_LINE = "Free 45-minute call. No purchase necessary.";

export const applyHero = {
  eyebrow: "Start Your Vending Business Today",
  // Was Kody's income headline ("$5-$60k/Month Vending Routes"); replaced
  // 2026-10-11 after the Google Ads "Unreliable claims" disapproval. Matches the
  // live ad headlines ("Start Your Vending Business", "Step-by-Step Coaching").
  headline: "Start Your Vending Business With Step-by-Step Coaching",
  // Presentation only: the phrase gets the blue highlight block.
  highlight: "Step-by-Step Coaching",
  subheadline: "Guided by Operators Who Are Doing It Now",
  body: "Map out your route on a free strategy call: which machines to start with, how to find locations, and what to look at in your market.",
  ctaLabel: "Book Your Free Strategy Call",
  // Points at the VSL directly under the hero (Adam, 2026-09-22).
  videoCue: "Watch Mike's story below",
} as const;

export const applyVsl = {
  // Kody, 2026-08-10. Caption is one plain segment because he supplied it with
  // no emphasis — reproduced verbatim rather than re-bolded.
  title: "Meet the Founder",
  subtitle: "Before you schedule your free consultation, watch this.",
  badge: "Free training",
  watchLabel: "Watch Mike's story",
  youtubeId: "P-Z1BZ9M-Fg",
  // Real publish date from YouTube's own player data for P-Z1BZ9M-Fg
  // (ytInitialPlayerResponse.microformat, read 2026-08-31). Required by the
  // VideoObject schema on /contact — update it if the VSL video is swapped.
  publishedAt: "2026-07-22T06:15:25-07:00",
  videoHref: "https://youtu.be/P-Z1BZ9M-Fg",
  caption: [
    {
      text: "Mike breaks down how the business model works, what makes a location worth pursuing, and how he and others have started a vending route with no experience while working a 9-to-5.",
    },
  ] satisfies RichSegment[],
} as const;

export const applyTools = {
  eyebrow: "What you get",
  title: "Exclusive access to proven tools & systems",
  body: "Building a vending business without guidance means wasted time and costly mistakes. We remove the guesswork with a structured roadmap, proprietary resources, and custom tools.",
  ctaLabel: "Book Your Call",
  items: [
    {
      icon: "course" as ToolIconKey,
      title: "Vending Accelerator Course",
      body: "Step-by-step lessons from your first pop-in to a full route, with scripts and contracts built in.",
    },
    {
      icon: "coaching" as ToolIconKey,
      title: "Expert Coaching & Support",
      body: "Weekly coaching calls plus 1-on-1 ambassador sessions to sharpen your locations, pitches, and product.",
    },
    {
      icon: "discounts" as ToolIconKey,
      title: "Exclusive Discounts",
      body: "Pre-negotiated machine deals and below-retail product pricing, so more of every sale stays yours.",
    },
    {
      icon: "community" as ToolIconKey,
      title: "A Community of Entrepreneurs",
      body: "Operators trading locations, planograms, and real answers every day, so you're never alone.",
    },
  ],
} as const;

// Member reviews, rendered as HTML cards. They were finished PNGs from Kody
// until 2026-09-22, and at phone width the baked-in text shrank to ~7px. The
// quotes are verbatim from those graphics; the headshots were cropped out of
// them into public/apply/reviews/headshots/. Every card is a five-star review.
export type ReviewCard = {
  readonly name: string;
  readonly headshot: string;
  readonly quote: string;
};

export const applyTestimonials = {
  eyebrow: "Member reviews",
  title: "What people are saying",
  cards: [
    {
      name: "George Hoover",
      headshot: "/apply/reviews/headshots/george-hoover.png",
      quote:
        "I have learned so much about this business since joining. Everyone in this community has been extremely helpful. I'm looking forward to contributing more to the group!",
    },
    {
      name: "Kelsey Corcoran",
      headshot: "/apply/reviews/headshots/kelsey-corcoran.png",
      quote:
        "I've only been a part of the community for less than 3 months and have gained much more than I expected! So glad to have found Mike & this community & would recommend this to everyone.",
    },
  ] satisfies ReviewCard[],
  // The wide member-spotlight card under the grid. Its income stat was dropped
  // 2026-10-11 (Google Ads "Unreliable claims").
  spotlight: {
    name: "Madison Graves",
    headshot: "/apply/reviews/headshots/madison-graves.png",
    quote:
      "The fastest way to learn is by learning from people who are in it, who are doing it, who have already been successful. The value of the community and the people you meet along the way is alone worth getting into the program.",
  },
} as const;

export const applyRoadmap = {
  eyebrow: "The roadmap",
  title: "How the program works",
  body: "Doing this alone usually means expensive mistakes. Here's the path members follow instead.",
  ctaLabel: "Book Your Call",
  phases: [
    {
      num: "01",
      range: "Step one",
      title: "Land your first location.",
      body: "Find high-traffic spots, walk in, and close them, backed by a platform showing every viable location in your market.",
    },
    {
      num: "02",
      range: "Step two",
      title: "Place and stock your first machine.",
      body: "Choose the right machine and product with member pricing and rebates. You start reading real sales data and dialing in your mix.",
    },
    {
      num: "03",
      range: "Step three",
      title: "Optimize and plan what's next.",
      body: "Tighten your first location, then decide where to go next. This is where it starts to feel like a business.",
    },
  ],
} as const;

// Full success-story cards (finished graphics from Kody) that replace the old
// "regular members" text list. Each card is clickable and links to that
// member's story on YouTube (Kody: "eventually onsite case studies, for now the
// YouTube vids"). Card art is portrait, ~880x1500. Each card's story + headline
// stats are transcribed into `alt` for screen readers, since the copy lives
// only inside the image.
export type SuccessStoryCard = {
  readonly name: string;
  readonly image: string;
  // Played in a dialog on the page (Adam, 2026-09-17) rather than opened on
  // youtube.com, so a booking page has no card that navigates the visitor away.
  readonly youtubeId: string;
  readonly alt: string;
};

export const applyMembers = {
  eyebrow: "Real members",
  title: "Regular people who ran the system",
  cards: [
    {
      name: "Anthony Kolodziej",
      image: "/apply/stories/anthony.png",
      youtubeId: "fsRX7K_Hg08",
      alt: "Success story — Anthony Kolodziej: laid off from a 14-year real estate career with zero vending experience, he used personal 0% APR credit cards for his first machines and scaled to a sustainable multi-site operation — $102K/month across 45 locations in about a year, at roughly 10 hours a week. “I built something my kids can see me build — and get the time and freedom to actually be there for them while I do it.” Watch his story.",
    },
    {
      name: "Mallorie Rauch",
      image: "/apply/stories/mallerie.png",
      youtubeId: "io1Jkei-yFs",
      alt: "Success story — Mallorie Rauch: working a full-time job and a mother of two, she and her husband bet on themselves and built a vending route to $4K/month across 6 locations in 8 months, at 5–6 hours a week part-time. “This is the right community to have access to people who've been insanely successful — to build this business right and avoid the mistakes people make without mentors.” Watch her story.",
    },
    {
      name: "Musa Sadi",
      image: "/apply/stories/moosa.png",
      youtubeId: "kb8ryBm6g9k",
      alt: "Success story — Musa Sadi: after losing his mother and younger brother and burning out of a hospitality career, he quit his job, found Mike Hoffman on YouTube, and rebuilt — 22 locations, 2 employees running his routes, a $41K single best month in about a year. “I genuinely feel freedom. At the end of the day, I do it for my mom and my brother.” Watch his story.",
    },
  ] satisfies SuccessStoryCard[],
} as const;

export const applyFaq = {
  eyebrow: "Questions",
  title: "Good to know",
  items: [
    {
      q: "How is this different from a course?",
      a: "A course is videos you watch alone. This is a live operator community, weekly coaching, 1-on-1 ambassadors, and group pricing — you build the business, you don't just study it.",
    },
    {
      q: "Where do I start?",
      a: "On a free strategy call we look at your market, the kinds of locations that fit it, and which machines to consider. From there, coaching walks you through finding locations and placing your first machine at your own pace.",
    },
    {
      q: "Do I need experience?",
      a: "No. Mike and most members started with none.",
    },
    {
      q: "Can I do this with a full-time job?",
      a: "Yes. Many members build alongside a full-time job, and the program is designed to fit around your schedule.",
    },
    {
      q: "How much work is it?",
      a: "It takes real work, especially early on: finding locations, stocking machines, and learning your market. Coaching and systems help you spend that time well.",
    },
  ],
} as const;

export const applyQuiz = {
  submitLabel: "Submit",
} as const;

export const applyFooter = {
  disclaimer:
    // Generic on purpose: the page makes no earnings claim for it to cover.
    "Earnings may vary and are not guaranteed. Outcomes depend on effort, market, and execution.",
  privacyNote:
    "By applying you agree to our Privacy Policy. We never sell your data.",
  // Light/transparent wordmark for the dark disclaimer band. Not delivered
  // yet — until public/apply/vendingpreneurs-logo-light.svg exists, the band
  // falls back to the text wordmark (clean, not a placeholder face).
  lightLogo: "/apply/vendingpreneurs-logo-light.svg",
} as const;

export const applySticky = {
  text: "Ready to start? Talk to a coach about your market.",
  ctaLabel: "Book Your Call",
} as const;

/** The in-page anchor every CTA scrolls to (the quiz section). */
export const APPLY_QUIZ_ANCHOR = "apply-form";

/** The VSL section, linked from the hero's "watch below" cue. */
export const APPLY_VSL_ANCHOR = "watch";
