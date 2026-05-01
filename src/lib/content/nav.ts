export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: ReadonlyArray<NavItem> = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Machine Marketplace", href: "/marketplace" },
  { label: "Vending Leads", href: "/leads" },
  { label: "Vending CPA Experts", href: "/cpa-experts" },
  { label: "Machine Financing", href: "/financing" },
  { label: "Vending Insurance", href: "/insurance" },
  { label: "Contact Us", href: "/contact" },
];

export const footerColumns: ReadonlyArray<{
  heading?: string;
  items: ReadonlyArray<NavItem>;
}> = [
  {
    items: [
      { label: "Home", href: "/" },
      { label: "News", href: "/news" },
      { label: "Vending CPA Experts", href: "/cpa-experts" },
    ],
  },
  {
    items: [
      { label: "About Us", href: "/about" },
      { label: "Vending Marketplace", href: "/marketplace" },
      { label: "Machine Financing", href: "/financing" },
    ],
  },
  {
    items: [
      { label: "Case Studies", href: "/case-studies" },
      { label: "Vending Leads", href: "/leads" },
      { label: "Vending Insurance", href: "/insurance" },
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
