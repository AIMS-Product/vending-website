import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingCreditPanel } from "./MarketingCreditPanel";

const row = (
  source: "Webinar" | "No marketing touch",
  entered: number | null,
  b: [number, number],
  w: [number, number],
  r: [number, number],
) => ({
  source,
  entered,
  booked: { self: b[0], reactivated: b[1] },
  won: { self: w[0], reactivated: w[1] },
  revenue: { self: r[0], reactivated: r[1] },
});

describe("MarketingCreditPanel", () => {
  it("renders both paths for every source, with totals", () => {
    const html = renderToStaticMarkup(
      <MarketingCreditPanel
        report={{
          ok: true,
          from: "2026-10-01",
          to: "2026-10-26",
          rows: [
            row("Webinar", 1502, [95, 98], [10, 5], [80000, 32114]),
            row("No marketing touch", null, [7, 146], [1, 8], [6000, 60170]),
          ],
        }}
      />,
    );
    for (const text of [
      "Oct 1–26",
      "1,502",
      "registered",
      "Reactivated, then booked",
      "$80,000",
      "$32,114",
      "$112,114",
      "12.8%", // 193 booked of 1,502 registered
      "Total",
    ]) {
      expect(html).toContain(text);
    }
  });
});
