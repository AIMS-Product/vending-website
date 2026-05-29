export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

// Nav labels describe their destination directly — a visitor can predict
// where each link goes from its label alone.
export const primaryNav: ReadonlyArray<NavItem> = [
  { label: "About", href: "/about" },
  { label: "Resources", href: "/pre-call-resources" },
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
      { label: "Resources", href: "/pre-call-resources" },
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
