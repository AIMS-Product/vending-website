/**
 * Solution pages — the `/solutions/<slug>` template's content source.
 *
 * Adding a solution page is adding an entry to `solutions` below. There is no
 * per-page component: `SolutionPage` renders every field, and the route's
 * `generateStaticParams` picks the new slug up automatically.
 *
 * Plain data, no server imports, so the sitemap, the chatbot route map and the
 * page can all read it.
 */

export type SolutionCta = {
  label: string;
  href: string;
  /** Filled brand button (default) or bordered white one. */
  variant?: "primary" | "ghost";
};

/**
 * A product visual: a video, a still, or neither.
 *
 * `video` wins over `src`. Videos are click-to-play (`preload="none"`), so a
 * page with four of them still costs nothing but the poster JPEGs on load.
 * With neither set the template draws a bordered frame labelled with `alt`,
 * so a page can ship its copy before its visuals exist.
 */
export type SolutionMedia = {
  /** Still image — a path under /public or an absolute https URL. */
  src?: string;
  /** MP4 URL. Takes precedence over `src`. */
  video?: string;
  /** Poster frame shown until the video is played. Match the video's size. */
  poster?: string;
  /**
   * Intrinsic pixel size of the asset. The frame takes its aspect ratio from
   * these, so the visual fills it edge to edge — no letterbox bars, and no
   * layout shift while the poster loads. Required for `video`; these
   * recordings are not 16:9 and a fixed frame ratio pillarboxes them.
   */
  width?: number;
  height?: number;
  alt: string;
};

export type SolutionTestimonial = {
  /** Which part of the story this quote proves, e.g. "On finding locations". */
  topic: string;
  quote: string;
  name: string;
  /** Route size · city, state. */
  meta: string;
  avatar?: string;
};

/** A numbered promise in the three-step strip under the thesis. */
export type SolutionStep = {
  label: string;
  title: string;
  body: string;
};

/** An alternating copy/visual block. Media side alternates automatically. */
export type SolutionFeature = {
  eyebrow: string;
  title: string;
  body: string;
  points: ReadonlyArray<string>;
  media: SolutionMedia;
};

export type SolutionRelated = {
  title: string;
  body: string;
  href: string;
};

export type Solution = {
  slug: string;
  /** Last breadcrumb crumb, e.g. "Locations". */
  breadcrumb: string;
  /** Product name above the h1. */
  eyebrow: string;
  title: string;
  intro: string;
  ctas: ReadonlyArray<SolutionCta>;
  hero: SolutionMedia;
  /** <title> and meta description. Falls back to title/intro when omitted. */
  metaTitle?: string;
  metaDescription?: string;
  /** Proof cards. Section is skipped entirely when empty. */
  testimonials: ReadonlyArray<SolutionTestimonial>;
  /** The one-sentence argument, set as a large centred h2. */
  thesis: string;
  steps: ReadonlyArray<SolutionStep>;
  features: ReadonlyArray<SolutionFeature>;
  closing: {
    title: string;
    body: string;
    ctas: ReadonlyArray<SolutionCta>;
  };
  /** Cards at the foot of the page. Section is skipped when empty. */
  related: ReadonlyArray<SolutionRelated>;
};

export const solutionsIndex = {
  eyebrow: "Solutions",
  title: "Tools that do the hard parts of vending for you",
  intro:
    "Finding locations, pitching them, and keeping a route profitable are three different jobs. Each of these is built for one of them.",
} as const;

export const solutions: ReadonlyArray<Solution> = [
  {
    slug: "vendscout",
    breadcrumb: "Locations",
    eyebrow: "VendScout",
    title: "Find, pitch, and secure vending locations",
    intro:
      "Stop driving neighborhoods hoping to spot a good lobby. VendScout hands you a ranked list of real locations, a professional website that makes you look like the obvious choice, and a signed contract the same day you pitch — so the only thing standing between you and your next machine is a phone call.",
    metaTitle: "VendScout — Find, Pitch, and Secure Vending Locations",
    metaDescription:
      "VendScout ranks real vending locations off the map, builds you a professional site that pitches for you, and sends an e-signature-ready contract before the prospect goes cold.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
    ],
    hero: {
      video: "https://www.vendhubhq.com/sales/videos/vendscout-v1.mp4",
      poster: "https://www.vendhubhq.com/sales/videos/vendscout-v1-poster.jpg",
      width: 1700,
      height: 1032,
      alt: "VendScout product walkthrough",
    },

    // Real operator quotes go here — three of them, one per stage (finding,
    // pitching, contracts). The section renders only once this is non-empty,
    // so the page ships without placeholder proof.
    testimonials: [],

    thesis:
      "You don't need a sales background to win locations. You need a system that does the finding, the pitching, and the paperwork for you — VendScout is that system.",
    steps: [
      {
        label: "01 · Find",
        title: "Ranked locations, in seconds",
        body: "Qualified offices, gyms, hospitals, and apartments pulled off the map — not a list you guess at.",
      },
      {
        label: "02 · Pitch",
        title: "A site that pitches for you",
        body: "Your branding, your domain, live in minutes — so you look like the obvious choice.",
      },
      {
        label: "03 · Secure",
        title: "Signed the same day",
        body: "Auto-filled, e-signature-ready contracts sent before the prospect goes cold.",
      },
    ],
    features: [
      {
        eyebrow: "Find locations",
        title: "Your next 100 locations, found before your coffee gets cold.",
        body: "Driving routes and cold pop-ins are how most new operators burn their first three months. VendScout pulls ranked, qualified locations off Google Maps in seconds — the offices, gyms, hospitals, and apartment complexes actually worth pitching, not a list you have to guess your way through.",
        points: [
          "Search any zip and radius: offices, gyms, hospitals, apartments, schools",
          "Every result comes with phone, email, address, and reviews already pulled",
          "Ranked by foot-traffic signal and location type, not guesswork",
          "One click imports your picks straight into your pipeline — no retyping, no spreadsheets",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/scout-map.mp4",
          poster: "https://www.vendhubhq.com/sales/videos/scout-map-poster.jpg",
          width: 1692,
          height: 1080,
          alt: "Searching the map for qualified vending locations in VendScout",
        },
      },
      {
        eyebrow: "Pitch with confidence",
        title: "Show up looking like you've done this a hundred times.",
        body: "Locations don't sign with operators who look like a side hustle. VendScout builds you a real vending website in minutes — your branding, your domain, a page that makes the pitch before you even open your mouth. Send the link before the meeting and walk in as the professional choice, not the unknown.",
        points: [
          "Pick a template and add your colors — live in minutes",
          "Custom domain support, like yourvendingbiz.com",
          "Built-in lead-capture forms wired straight to your pipeline",
          "SEO-optimized pages so locations can find you first",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/website.mp4",
          poster: "https://www.vendhubhq.com/sales/videos/website-poster.jpg",
          width: 1700,
          height: 1080,
          alt: "Building a branded vending website in VendScout",
        },
      },
      {
        eyebrow: "Secure the deal",
        title:
          "Weeks of “let me run it by corporate” become one signed contract.",
        body: "The deal dies in the gap between the handshake and the paperwork. VendScout closes that gap: pick a template, auto-fill it from your CRM, and send a branded, e-signature-ready contract before the prospect has time to go cold.",
        points: [
          "Templates for the common deal structures, ready to send",
          "Auto-populated with location, operator, term, and commission",
          "Photorealistic mockups so the location can picture the machine in place",
          "Branded PDF export, e-signature ready",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/scout-contracts.mp4",
          poster:
            "https://www.vendhubhq.com/sales/videos/scout-contracts-poster.jpg",
          width: 1700,
          height: 1080,
          alt: "Generating and sending a location contract in VendScout",
        },
      },
    ],
    closing: {
      title: "Your first location is closer than you think.",
      body: "Every operator in the Vendingpreneurs community started with one signed location. VendScout is how you get there faster — find the lead, make the pitch, sign the deal.",
      ctas: [
        { label: "Start Your Vending Business", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Case Studies",
        body: "Operators who started exactly where you are, and what their routes look like now.",
        href: "/case-studies",
      },
      {
        title: "Resources",
        body: "Playbooks, teardowns, and answers to the questions every new operator hits.",
        href: "/news",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
];

export function listSolutionSlugs(): ReadonlyArray<string> {
  return solutions.map((solution) => solution.slug);
}

export function getSolution(slug: string): Solution | undefined {
  return solutions.find((solution) => solution.slug === slug);
}
