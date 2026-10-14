/**
 * The funnels a marketing link can feed: Close's "Funnel Name DEAL (Opp)"
 * choices, copied from the Close field on 2026-10-14. One list for the link
 * builder, the registry and Dom's booked-call rules, so a link's funnel is
 * always a value Close itself can hold.
 *
 * A new choice in Close goes here too. The database column is plain text, so
 * no migration is needed.
 */
export const FUNNEL_NAMES = [
  "Affiliate",
  "Anthony IG",
  "Anthony X",
  "Direct Traffic",
  "GoHighLevel",
  "Google Ads",
  "Instagram",
  "Internal Webinar",
  "Linkedin",
  "LinkedIn Ads",
  "Low Ticket Funnel",
  "LTF - In-House",
  "LTF - Quiz Funnel",
  "Meta Ads",
  "Mike Newsletter",
  "No Attribution",
  "OLD Organic - Misc - Cam",
  "Passivepreneurs",
  "Podcast - Paid",
  "Q4 Misc Traffic Cam",
  "Reactivation Email",
  "Reactivation Email Setter",
  "Reactivation Scrapers",
  "Referred",
  "Sales Reactivation",
  "Search - OG",
  "Side Hustle Nation",
  "TikTok",
  "VSL",
  "Website",
  "Website - OG - Cam",
  "WWWS",
  "X",
  "YouTube",
  "YouTube Ads",
] as const;

export type FunnelName = (typeof FUNNEL_NAMES)[number];

export function isFunnelName(value: string): value is FunnelName {
  return (FUNNEL_NAMES as readonly string[]).includes(value);
}
