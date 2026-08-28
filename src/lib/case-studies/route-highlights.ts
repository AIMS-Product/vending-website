/**
 * Highlights for the article sidebar.
 *
 * Kody's ask, verbatim: "highlights about them and their route - # of
 * machines, months in the program, etc." So the numbers are the point here.
 * They also appear in `StatsStrip` under the video; that repetition is
 * intentional and his call. The sidebar is sticky, so these stay on screen
 * while the reader scrolls past the strip.
 *
 * Coverage across the 25 published stories is uneven (location types 22/25,
 * locations 18/25, machines 15/25, months 12/25), so only present fields are
 * returned and the card shrinks to fit. Nothing is zero-filled: "0 machines"
 * reads as a claim, and it is not one.
 *
 * `prior_occupation` used to lead this list. It moved to the "Who they are"
 * panel, which owns the person; this one owns the route. Leaving it in both
 * printed "Before vending" twice, one card above the other.
 */
export type RouteHighlight = { label: string; value: string };

export type RouteHighlightSource = {
  location_types: readonly string[] | null;
  machine_count: number | null;
  location_count: number | null;
  months_to_result: number | null;
};

export function buildRouteHighlights(
  caseStudy: RouteHighlightSource,
): RouteHighlight[] {
  const highlights: RouteHighlight[] = [];

  // `> 0` rather than `!= null` throughout: a zero here is a data gap, not a
  // result worth printing next to a member's name.
  if (caseStudy.machine_count !== null && caseStudy.machine_count > 0) {
    highlights.push({
      label: "Machines",
      value: String(caseStudy.machine_count),
    });
  }

  if (caseStudy.location_count !== null && caseStudy.location_count > 0) {
    highlights.push({
      label: "Locations",
      value: String(caseStudy.location_count),
    });
  }

  const months = caseStudy.months_to_result;
  if (months !== null && months > 0) {
    highlights.push({
      label: "Months in the program",
      value: `${months} ${months === 1 ? "month" : "months"}`,
    });
  }

  const locationTypes = (caseStudy.location_types ?? [])
    .map((type) => type?.trim())
    .filter((type): type is string => Boolean(type));
  if (locationTypes.length > 0) {
    highlights.push({
      label: "Where they place",
      value: locationTypes.map(humanizeLocationType).join(" · "),
    });
  }

  return highlights;
}

/** `retirement-community` -> `Retirement community`. */
function humanizeLocationType(type: string): string {
  const spaced = type.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
