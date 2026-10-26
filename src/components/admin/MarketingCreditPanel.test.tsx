import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingCreditPanel } from "./MarketingCreditPanel";

describe("MarketingCreditPanel", () => {
  it("renders every section with the totals it was given", () => {
    const html = renderToStaticMarkup(
      <MarketingCreditPanel
        report={{
          ok: true,
          from: "2026-10-01",
          to: "2026-10-26",
          selfBooked: {
            total: 240,
            bySurface: {
              Webinar: 67,
              "Site form": 110,
              Chatbot: 5,
              "Follow-up email": 0,
              "Other marketing link": 2,
              "No tag": 56,
            },
          },
          credit: [
            {
              source: "Webinar",
              booked: 193,
              themselves: 95,
              bySetter: 98,
              won: 15,
              revenue: 112114,
            },
            {
              source: "No marketing touch",
              booked: 153,
              themselves: 7,
              bySetter: 146,
              won: 9,
              revenue: 66170,
            },
          ],
          siteForms: {
            filled: 409,
            bookedThemselves: 126,
            bookedBySetter: [{ setter: "Connor George", count: 27 }],
            notBooked: [{ status: "New", count: 171 }],
          },
          chat: {
            chats: 79,
            gaveEmail: 21,
            bookedInChat: 7,
            bookedLaterThemselves: 4,
            bookedLaterBySetter: 3,
          },
          reactivation: {
            calls: 316,
            assistedCalls: 170,
            wins: 19,
            assistedWins: 12,
            assistedRevenue: 117720,
          },
        }}
      />,
    );
    for (const text of [
      "First calls by where the person came from",
      "Site form fills",
      "Site chatbot",
      "Connor George",
      "$112,114",
      "170 of 316",
      "$117,720",
      "193",
    ]) {
      expect(html).toContain(text);
    }
    // Booked calls marketing started = total minus the no-touch row.
    expect(html).toContain("193</p>");
  });
});
