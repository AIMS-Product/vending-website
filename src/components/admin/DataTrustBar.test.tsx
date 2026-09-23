import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTrustBar } from "@/components/admin/DataTrustBar";
import { UnverifiedMark } from "@/components/admin/TrustMarks";
import { buildTrustBar, type AuditCheck } from "@/lib/analytics/data-trust-bar";

const NOW = new Date("2026-09-22T18:00:00Z");
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const failedRevenue: AuditCheck = {
  checkId: "mom-revenue",
  label: "Month over month: revenue",
  window: "2026-08-01 to 2026-08-31",
  status: "fail",
  detail: "We show $100; Close says $150.",
};

describe("DataTrustBar", () => {
  it("says in red that last night's checks did not run", () => {
    const html = renderToStaticMarkup(
      <DataTrustBar
        model={buildTrustBar({
          scope: "close",
          feeds: [{ feed: "close", lastSuccessAt: hoursAgo(1) }],
          run: { runAt: hoursAgo(50), checks: [] },
          now: NOW,
        })}
      />,
    );
    expect(html).toContain("Did not run");
    expect(html).toContain("the check did not run last night");
    expect(html).toContain('href="/admin/data"');
    expect(html).toContain('href="#definitions"');
  });

  it("names the unverified number and why, in visible text", () => {
    const model = buildTrustBar({
      scope: "mom",
      feeds: [
        { feed: "close", lastSuccessAt: hoursAgo(1) },
        { feed: "site-leads", lastSuccessAt: hoursAgo(1) },
      ],
      run: { runAt: hoursAgo(5), checks: [failedRevenue] },
      now: NOW,
    });
    const html = renderToStaticMarkup(<DataTrustBar model={model} />);
    expect(html).toContain("0 of 1 passed");
    expect(html).toContain("Unverified on this tab");
    expect(html).toContain("Revenue");
    expect(html).toContain("Close says $150");

    const mark = renderToStaticMarkup(<UnverifiedMark flag={model.flags[0]} />);
    expect(mark).toContain(">Unverified<");
    expect(mark).toContain("title=");
  });

  it("says a feed is not connected in words, apart from the date", () => {
    const html = renderToStaticMarkup(
      <DataTrustBar
        model={buildTrustBar({
          scope: "booked",
          feeds: [
            { feed: "close", lastSuccessAt: hoursAgo(1) },
            { feed: "calendly", lastSuccessAt: hoursAgo(1) },
          ],
          run: null,
          now: NOW,
        })}
      />,
    );
    expect(html).not.toContain("is not");

    const model = buildTrustBar({
      scope: "data",
      feeds: [{ feed: "bitly", lastSuccessAt: null, connected: false }],
      run: null,
      now: NOW,
    });
    const withBitly = renderToStaticMarkup(<DataTrustBar model={model} />);
    expect(withBitly).toContain("Bitly clicks</span> is not");
    expect(withBitly).toContain("no click has ever been stored");
  });

  it("renders nothing next to a number whose check passed", () => {
    expect(renderToStaticMarkup(<UnverifiedMark flag={undefined} />)).toBe("");
  });
});
