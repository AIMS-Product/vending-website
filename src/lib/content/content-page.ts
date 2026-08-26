/**
 * The shape behind every page rendered by `ContentPage` — currently
 * `/solutions/<slug>` (sells a product) and `/process/<slug>` (teaches a
 * step). Both are the same page: a hero, an argument, three beats, alternating
 * copy/visual blocks, a closing card.
 *
 * The two registries (`solutions.ts`, `process.ts`) are the only content;
 * there is no per-page component. Adding a page is adding an entry.
 *
 * Plain data, no server imports, so the sitemap, the chatbot route map and the
 * page can all read it.
 */

export type PageCta = {
  label: string;
  href: string;
  /** Filled brand button (default) or bordered white one. */
  variant?: "primary" | "ghost";
};

/**
 * A visual: a video, a still, or neither.
 *
 * `video` wins over `src`. Videos are click-to-play (`preload="none"`), so a
 * page with four of them still costs nothing but the poster JPEGs on load.
 * With neither set the template draws a bordered frame labelled with `alt`,
 * so a page can ship its copy before its visuals exist.
 */
export type PageMedia = {
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

export type PageTestimonial = {
  /** Which part of the story this quote proves, e.g. "On finding locations". */
  topic: string;
  quote: string;
  name: string;
  /** Route size · city, state. */
  meta: string;
  avatar?: string;
};

/** A numbered promise in the three-beat strip under the thesis. */
export type PageStep = {
  label: string;
  title: string;
  body: string;
};

/**
 * A copy block. With `media` it renders as an alternating two-column block and
 * the visual side flips automatically. Without it the block goes full width —
 * no reserved frame, no placeholder — which is the default here: there is one
 * hero asset per page at most, and inventing a decorative image per block
 * would mean thirteen more files to keep current.
 */
export type PageFeature = {
  eyebrow: string;
  title: string;
  body: string;
  points: ReadonlyArray<string>;
  media?: PageMedia;
  /** Rendered as a card strip under the copy. Skipped when empty. */
  stats?: ReadonlyArray<PageStat>;
};

/**
 * A figure worth setting large. Number-heavy feature blocks render these as
 * cards instead of burying the same figure in a bullet — the numbers are the
 * strongest content on these pages and a stock photo beside them is noise.
 */
export type PageStat = {
  /** The figure itself, e.g. "33%" or "18–24 mo". */
  value: string;
  label: string;
};

export type PageRelated = {
  title: string;
  body: string;
  href: string;
};

export type ContentPage = {
  slug: string;
  /**
   * The middle breadcrumb crumb — the section this page lives in. Explicit
   * rather than derived: the template serves more than one route prefix, and
   * a defaulted crumb would silently label a process page "Solutions".
   */
  parent: { label: string; href: string };
  /** Last breadcrumb crumb, e.g. "Locations". */
  breadcrumb: string;
  /** Product or step name above the h1. */
  eyebrow: string;
  title: string;
  intro: string;
  ctas: ReadonlyArray<PageCta>;
  /**
   * One asset per page, at most. Omitted entirely on pages where no honest
   * visual exists — the hero then sets its copy full width rather than
   * pairing it with a frame that means nothing.
   */
  hero?: PageMedia;
  /** <title> and meta description. Falls back to title/intro when omitted. */
  metaTitle?: string;
  metaDescription?: string;
  /**
   * Hold the page back from search: emits `noindex, follow` and drops the page
   * from the sitemap. The page still resolves normally at its URL.
   *
   * Set while copy is live on production but not yet signed off. Removing the
   * flag is the whole act of publishing it — there is no second switch.
   */
  noindex?: boolean;
  /** Proof cards. Section is skipped entirely when empty. */
  testimonials: ReadonlyArray<PageTestimonial>;
  /** The one-sentence argument, set as a large centred h2. */
  thesis: string;
  steps: ReadonlyArray<PageStep>;
  /**
   * Optional single CTA under the step rail, for a page that can name the
   * next action before the reader has scrolled all three blocks. Skipped when
   * omitted — most pages let the closing card carry the ask.
   */
  stepsCta?: PageCta;
  features: ReadonlyArray<PageFeature>;
  closing: {
    title: string;
    body: string;
    ctas: ReadonlyArray<PageCta>;
  };
  /** Cards at the foot of the page. Section is skipped when empty. */
  related: ReadonlyArray<PageRelated>;
};
