import type { Change, Range } from "@/lib/services/marketing-mtd";

/** Shared formatting for the Marketing MTD panels. */

export const TH = "px-3 py-2.5 text-right font-semibold whitespace-nowrap";
export const TD =
  "px-3 py-2 text-right tabular-nums whitespace-nowrap align-top";

export const pct = (share: number | null) =>
  share === null ? "—" : `${(share * 100).toFixed(1)}%`;
export const days = (value: number | null) =>
  value === null
    ? "—"
    : `${Number.isInteger(value) ? value : value.toFixed(1)} ${value === 1 ? "day" : "days"}`;
const signed = (value: number, unit: string) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}${unit}`;

export function changeText(change: Change): string {
  switch (change.kind) {
    case "pct":
      return signed(change.value, "%");
    case "pp":
      return signed(change.value, " pp");
    case "new":
      return "New";
    case "none":
      return "No change";
    case "na":
      return "—";
  }
}

export function rangeLabel(range: Range): string {
  const month = new Date(`${range.from}T00:00:00Z`).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${month} ${Number(range.from.slice(8, 10))}–${Number(range.to.slice(8, 10))}`;
}
