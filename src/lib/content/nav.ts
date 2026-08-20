export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

/**
 * The header's primary conversion button. Lived inline in Header.tsx until
 * 2026-08-10; copy belongs in a content module like every other string.
 */
export const headerCta = { label: "Get Started", href: "/contact" } as const;

// Nav labels describe their destination directly — a visitor can predict
// where each link goes from its label alone.
//
// "Resources" points at /news on Kody's 2026-08-10 instruction (he gave the
// absolute https://www.vendingpreneurs.com/news; the internal path is the same
// page and keeps client-side navigation). He confirmed on 2026-08-11 that the
// header keeping both Resources and News on /news is intended; /pre-call-
// resources is re-linked from the footer as "Prepare for Your Call".
export const primaryNav: ReadonlyArray<NavItem> = [
  { label: "About", href: "/about" },
  { label: "Resources", href: "/news" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "News", href: "/news" },
];

export const footerColumns: ReadonlyArray<{
  items: ReadonlyArray<NavItem>;
}> = [
  {
    items: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Resources", href: "/news" },
    ],
  },
  {
    items: [
      { label: "Case Studies", href: "/case-studies" },
      // Kody, 2026-08-11: this footer slot becomes the way back to the
      // pre-call resources page. He plans to build that page out further.
      { label: "Prepare for Your Call", href: "/pre-call-resources" },
    ],
  },
  {
    items: [
      { label: "Contact Us", href: "/contact" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

/**
 * Brand social accounts, in the order they appear in the footer.
 *
 * Every handle here was confirmed live against the real account on 2026-08-20.
 * Two the team might expect are deliberately absent: x.com/vendingpreneurs
 * returns a 404 and facebook.com/vendingpreneurs is not publicly available, so
 * linking either would ship a dead link. The Meta traffic in analytics is ad
 * spend, not an organic page.
 */
export const socialLinks: ReadonlyArray<{
  label: string;
  href: string;
  icon: "youtube" | "instagram" | "tiktok" | "linkedin";
}> = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/@Vendingpreneurs",
    icon: "youtube",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/vendingpreneurs/",
    icon: "instagram",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@vendingpreneurs",
    icon: "tiktok",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/vendingpreneurs",
    icon: "linkedin",
  },
];
