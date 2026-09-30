import "server-only";

import { unstable_cache } from "next/cache";

import { config } from "@/lib/config";
import { GHL_VALUE_NAMES, parseWebinarStart } from "@/lib/content/masterclass";
import { createGhlClient } from "@/lib/ghl/client";

export type MasterclassEvent = {
  /** The GHL text as written, shown when the countdown cannot be computed. */
  label: string | null;
  /** ISO instant, or null when the GHL text did not parse. */
  startsAt: string | null;
  anthony: { locations: string; machines: string; revenue: string } | null;
};

/**
 * The next webinar, read from the same GHL custom values every GHL page reads,
 * so this page rolls forward with the existing weekly rollover and never needs
 * its own date edit. A failed read degrades to no date and no stats; it never
 * blocks registration, and it is reported rather than swallowed.
 */
/**
 * One GHL read per 5 minutes per region, not one per page view and submit: the
 * registration path shares the location's 100-requests-per-10s budget. A
 * failed read throws, and unstable_cache never stores a throw.
 */
const cachedCustomValues = unstable_cache(
  // Config is read inside, so the token never becomes part of a cache key.
  () =>
    createGhlClient({
      apiKey: config.GHL_API_KEY ?? "",
      locationId: config.GHL_LOCATION_ID ?? "",
    }).listCustomValues(),
  ["masterclass-ghl-custom-values"],
  { revalidate: 300 },
);

export async function getMasterclassEvent(): Promise<MasterclassEvent> {
  if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) {
    return { label: null, startsAt: null, anthony: null };
  }
  try {
    const values = new Map(
      (await cachedCustomValues()).map((v) => [v.name, v.value.trim()]),
    );
    const label = values.get(GHL_VALUE_NAMES.dateTime) || null;
    const start = label ? parseWebinarStart(label) : null;
    const locations = values.get(GHL_VALUE_NAMES.locations);
    const machines = values.get(GHL_VALUE_NAMES.machines);
    const revenue = values.get(GHL_VALUE_NAMES.revenue);
    return {
      label,
      startsAt: start?.toISOString() ?? null,
      anthony:
        locations && machines && revenue
          ? { locations, machines, revenue }
          : null,
    };
  } catch (error) {
    console.error("masterclass: GHL custom values read failed", error);
    return { label: null, startsAt: null, anthony: null };
  }
}
