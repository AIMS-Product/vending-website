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
// page and keeps client-side navigation). This leaves two nav entries aimed at
// /news and orphans /pre-call-resources — raised with him, awaiting an answer.
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
      { label: "News", href: "/news" },
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
