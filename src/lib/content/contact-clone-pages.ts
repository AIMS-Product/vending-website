/**
 * Routes that render the /contact funnel verbatim, differing only in the
 * source_path their leads carry so each channel's leads are attributable.
 *
 * Migration sheet, "Clone Contact" (Adam, 2026-09-17). The six added that day
 * were legacy pages that captured a lead and stopped: they had no calendar on
 * them at all, so every visitor from those channels fell into setter outreach
 * whether or not they were ready to book. They now run the scored funnel.
 *
 * A slug here must also be removed from `legacyLeadRoutes` — a real app route
 * shadows the `[legacyLeadPath]` entry, leaving dead config behind that looks
 * live. `legacy-routes.test.ts` fails if the two ever overlap.
 */
export const CONTACT_CLONE_SLUGS = [
  "booking-youtube",
  "booking-meta",
  "booking-internal-ltf",
  "booking-partner",
  "booking-passivepreneurs",
  "booking-reactivation-email",
] as const;

export type ContactCloneSlug = (typeof CONTACT_CLONE_SLUGS)[number];

export function contactClonePath(slug: ContactCloneSlug): `/${string}` {
  return `/${slug}`;
}
