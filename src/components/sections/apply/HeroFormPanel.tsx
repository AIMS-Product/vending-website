// The booking card that rides in the right column of the hero (Adam,
// 2026-09-17): the form has to be on the first screen next to the pitch, not a
// dark band further down the page. Shared by the qualification quiz and the
// social-ad booking form so the two never drift.
//
// PublicLeadForm already renders its own white card, so this is only the
// wrapper. The card carries no heading and no proof rail of its own: the hero
// headline beside it says what the page is for, and the member quote and trust
// stats sit in the left column where they balance the form's height.
export function HeroFormPanel({ children }: { children: React.ReactNode }) {
  return <div className="w-full">{children}</div>;
}
