import { describe, expect, it } from "vitest";
import {
  buildLinkCoverage,
  type CoverageLeadRow,
  type CoverageLinkRow,
} from "@/lib/services/link-coverage";

const WINDOW = { start: "2026-08-19", end: "2026-09-18" };

function lead(overrides: Partial<CoverageLeadRow> = {}): CoverageLeadRow {
  return {
    created_at: "2026-09-01T00:00:00.000Z",
    source_path: "/",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    ...overrides,
  };
}

const REGISTERED: CoverageLinkRow = {
  utm_source: "newsletter",
  utm_medium: "email",
  utm_campaign: "sept14",
  utm_content: "free-market-analysis",
  utm_term: "book-call",
  label: "Email newsletter Adhoc",
};

const onRegisteredLink = () =>
  lead({
    utm_source: "newsletter",
    utm_medium: "email",
    utm_campaign: "sept14",
    utm_content: "free-market-analysis",
    utm_term: "book-call",
    source_path: "/",
  });

const onUntrackedLink = (path = "/booking-youtube") =>
  lead({
    utm_source: "youtube",
    utm_medium: "video",
    utm_campaign: "vending-101",
    utm_content: "desc-link-1",
    utm_term: null,
    source_path: path,
  });

describe("buildLinkCoverage", () => {
  it("splits leads into registered, unregistered and untagged", () => {
    const report = buildLinkCoverage({
      leads: [onRegisteredLink(), onUntrackedLink(), lead()],
      links: [REGISTERED],
      window: WINDOW,
    });

    expect(report.totals).toMatchObject({
      leads: 3,
      registered: 1,
      unregistered: 1,
      untagged: 1,
    });
    expect(report.registrySize).toBe(1);
  });

  it("measures coverage over tagged leads only, so organic traffic is not a miss", () => {
    const report = buildLinkCoverage({
      leads: [onRegisteredLink(), lead(), lead(), lead()],
      links: [REGISTERED],
      window: WINDOW,
    });

    // 1 registered of 1 tagged. The three untagged leads had no link to register.
    expect(report.totals.registeredPct).toBe(100);
    expect(report.totals.untagged).toBe(3);
  });

  it("returns null rather than zero when nothing in the window was tagged", () => {
    const report = buildLinkCoverage({
      leads: [lead(), lead()],
      links: [REGISTERED],
      window: WINDOW,
    });

    expect(report.totals.registeredPct).toBeNull();
  });

  it("returns null for an empty window instead of inventing a rate", () => {
    const report = buildLinkCoverage({ leads: [], links: [], window: WINDOW });

    expect(report.totals.registeredPct).toBeNull();
    expect(report.totals.leads).toBe(0);
    expect(report.worklist).toEqual([]);
  });

  it("needs the whole tuple to match: a different destination is a different link", () => {
    const report = buildLinkCoverage({
      leads: [lead({ ...REGISTERED_AS_LEAD, utm_term: "lead-magnet" })],
      links: [REGISTERED],
      window: WINDOW,
    });

    expect(report.totals.registered).toBe(0);
    expect(report.totals.unregistered).toBe(1);
  });

  it("matches the registry regardless of case and padding", () => {
    const report = buildLinkCoverage({
      leads: [lead({ ...REGISTERED_AS_LEAD, utm_source: "  Newsletter " })],
      links: [REGISTERED],
      window: WINDOW,
    });

    expect(report.totals.registered).toBe(1);
  });

  it("groups the worklist by link and counts the leads each one brought", () => {
    const report = buildLinkCoverage({
      leads: [
        onUntrackedLink("/booking-youtube"),
        onUntrackedLink("/booking-youtube"),
        onUntrackedLink("/contact"),
      ],
      links: [],
      window: WINDOW,
    });

    expect(report.worklist).toHaveLength(1);
    const [row] = report.worklist;
    expect(row?.leads).toBe(3);
    expect(row?.channel).toBe("YouTube");
    expect(row?.landingPaths).toEqual(["/booking-youtube", "/contact"]);
  });

  it("names the missing destination without guessing it from the landing page", () => {
    const report = buildLinkCoverage({
      leads: [onUntrackedLink("/booking-youtube")],
      links: [],
      window: WINDOW,
    });

    const [row] = report.worklist;
    expect(row?.term).toBeNull();
    expect(row?.problems).toContain("utm_term (destination) is missing.");
    // /booking-youtube is obviously a booking page. It still does not make the
    // destination "book-call": only the link can say that.
    expect(row?.problems.join(" ")).not.toContain("book-call");
  });

  it("breaks coverage down by channel", () => {
    const report = buildLinkCoverage({
      leads: [onRegisteredLink(), onUntrackedLink(), onUntrackedLink()],
      links: [REGISTERED],
      window: WINDOW,
    });

    const youtube = report.byChannel.find((row) => row.channel === "YouTube");
    const newsletter = report.byChannel.find(
      (row) => row.channel === "Newsletter",
    );
    expect(youtube).toMatchObject({ unregistered: 2, registeredPct: 0 });
    expect(newsletter).toMatchObject({ registered: 1, registeredPct: 100 });
  });

  it("keeps untagged leads out of the worklist: there is no link to rebuild", () => {
    const report = buildLinkCoverage({
      leads: [lead(), lead()],
      links: [],
      window: WINDOW,
    });

    expect(report.worklist).toEqual([]);
    expect(report.totals.untagged).toBe(2);
  });
});

const REGISTERED_AS_LEAD = {
  utm_source: "newsletter",
  utm_medium: "email",
  utm_campaign: "sept14",
  utm_content: "free-market-analysis",
  utm_term: "book-call",
} satisfies Partial<CoverageLeadRow>;
