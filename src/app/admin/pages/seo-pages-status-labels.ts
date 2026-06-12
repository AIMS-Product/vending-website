import type { SeoReadinessStatus } from "@/lib/page-builder/seo-readiness";

// N7 / issue I7: the pages list previously signalled readiness and page status
// with colour-only dots. These helpers pair each dot with a visible text label
// (and drive a legend) so sighted users never have to decode colour alone.

export type StatusDotTone = "amber" | "blue" | "green" | "red" | "slate";

export type StatusLegendEntry = {
  tone: StatusDotTone;
  label: string;
};

export function readinessDotTone(status: SeoReadinessStatus): StatusDotTone {
  if (status === "strong") return "green";
  if (status === "blocked") return "red";
  if (status === "needs_work") return "amber";
  return "blue";
}

export function pageStatusDotTone(status: string): StatusDotTone {
  if (status === "published") return "green";
  if (status === "archived") return "slate";
  return "amber";
}

// Marketer-facing page status label (admin-studio.md: no raw schema values).
export function pageStatusLabel(status: string): string {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  if (status === "draft") return "Draft";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Stable legend rows for the two list signals, used in the header so the dot +
// label vocabulary is explained once for the whole table.
export const readinessLegend: readonly StatusLegendEntry[] = [
  { tone: "green", label: "Strong" },
  { tone: "blue", label: "Opportunities" },
  { tone: "amber", label: "Needs work" },
  { tone: "red", label: "Blocked" },
] as const;

export const pageStatusLegend: readonly StatusLegendEntry[] = [
  { tone: "green", label: "Published" },
  { tone: "amber", label: "Draft" },
  { tone: "slate", label: "Archived" },
] as const;

export function dotToneClass(tone: StatusDotTone): string {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-400";
  if (tone === "red") return "bg-rose-500";
  if (tone === "slate") return "bg-slate-400";
  return "bg-sky-500";
}
