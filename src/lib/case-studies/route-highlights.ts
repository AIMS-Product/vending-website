/**
 * Highlights for the article sidebar.
 *
 * Deliberately carries NO numbers. `StatsStrip` sits directly under the video
 * and owns revenue, machines, locations and time-to-result; a sidebar that
 * repeated any of them would just be the strip again in a narrower box.
 * This card answers the other question — who the member was before vending
 * and what kind of places their route runs through.
 *
 * Coverage across the 25 published stories is uneven (prior occupation 24/25,
 * location types 22/25), so only present fields are returned and the card
 * shrinks to fit. Every published story has at least one of the two. Nothing
 * is zero-filled: a story padded with a blank slot is worse than a short card.
 */
export type RouteHighlight = { label: string; value: string };

export type RouteHighlightSource = {
  prior_occupation: string | null;
  location_types: readonly string[] | null;
};

export function buildRouteHighlights(
  caseStudy: RouteHighlightSource,
): RouteHighlight[] {
  const highlights: RouteHighlight[] = [];

  const priorOccupation = caseStudy.prior_occupation?.trim();
  if (priorOccupation) {
    highlights.push({ label: "Before vending", value: priorOccupation });
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
