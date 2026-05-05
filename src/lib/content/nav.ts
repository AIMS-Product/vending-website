export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

/**
 * The five "partner" pages on the live Webflow site (Marketplace, Leads,
 * CPA Experts, Financing, Insurance) are external links to vendhub.ai.
 * We mirror that here. If/when those become real internal pages we can
 * flip `external` and add a route.
 */
const VENDHUB_URL = "https://www.vendhub.ai/";

export const primaryNav: ReadonlyArray<NavItem> = [
  { label: "Home", href: "/" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About Us", href: "/about" },
  { label: "Resources", href: "/pre-call-resources" },
  { label: "Contact Us", href: "/contact" },
];

export const footerColumns: ReadonlyArray<{
  items: ReadonlyArray<NavItem>;
}> = [
  {
    items: [
      { label: "Home", href: "/" },
      { label: "News", href: "/news" },
      { label: "Vending CPA Experts", href: VENDHUB_URL, external: true },
    ],
  },
  {
    items: [
      { label: "About Us", href: "/about" },
      { label: "Vending Marketplace", href: VENDHUB_URL, external: true },
      { label: "Machine Financing", href: VENDHUB_URL, external: true },
    ],
  },
  {
    items: [
      { label: "Case Studies", href: "/case-studies" },
      { label: "Vending Leads", href: VENDHUB_URL, external: true },
      { label: "Vending Insurance", href: VENDHUB_URL, external: true },
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
