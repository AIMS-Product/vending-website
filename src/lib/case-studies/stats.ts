import type { Json } from "@/types/database";

/** One entry in a case study's `stats` jsonb column. */
export type CaseStudyStat = { label: string; value: string };

/**
 * `stats` is `Json` at the type level because that is all Postgres promises.
 * Narrow it once, here, so no caller has to trust the column's shape. A row
 * with a malformed stat renders without it rather than crashing the page.
 *
 * This lives outside `services/case-studies.ts` on purpose. The service is
 * `server-only` (it can reach the service-role client), and the admin editor
 * is a Client Component that needs this same parser. Importing it from the
 * service pulled the whole server chain into the browser bundle and broke the
 * build — a pure helper shared by both sides belongs in neither half.
 */
export function parseStats(value: Json): CaseStudyStat[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const { label, value: statValue } = entry as Record<string, unknown>;
    if (typeof label !== "string" || typeof statValue !== "string") return [];
    const trimmedLabel = label.trim();
    const trimmedValue = statValue.trim();
    if (!trimmedLabel || !trimmedValue) return [];
    return [{ label: trimmedLabel, value: trimmedValue }];
  });
}
