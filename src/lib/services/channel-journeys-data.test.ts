import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The loader's select strings, guarded as source.
 *
 * `page()` casts each query to its row type (`as Promise<JourneyVisitRow[]>`),
 * which is what let a column go missing from the select while the type kept
 * claiming it was there. TypeScript cannot see past the cast, so the guard has
 * to read the string.
 *
 * The failure it prevents: on 2026-09-18 the ga4_page_views select omitted
 * `utm_campaign`. ga4_page_views has no medium column, so resolveGa4Channel
 * uses the campaign to tell a paid google session from an organic one — with it
 * undefined, every Google Ads session resolved to Organic search and the
 * Journeys tab showed Google Ads at 0 visits against 96 leads. The real figure
 * was 4,716. Nothing failed; a money channel just read as dead.
 */
const SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/services/channel-journeys-data.ts"),
  "utf8",
);

function selectFor(table: string): string {
  // The .select(...) that follows .from("<table>"), newlines and all.
  const from = SOURCE.indexOf(`.from("${table}")`);
  expect(from, `no .from("${table}") in the loader`).toBeGreaterThan(-1);
  const select = SOURCE.indexOf(".select(", from);
  const close = SOURCE.indexOf(")", select);
  return SOURCE.slice(select, close).replace(/\s+/g, "");
}

describe("channel journeys loader selects every column the report reads", () => {
  it("fetches utm_campaign for GA4 visits, or paid search reads as organic", () => {
    expect(selectFor("ga4_page_views")).toContain("utm_campaign");
  });

  it("fetches utm_source for GA4 visits", () => {
    expect(selectFor("ga4_page_views")).toContain("utm_source");
  });

  it("fetches the lead columns the channel resolver needs", () => {
    const leads = selectFor("lead_submissions");
    // resolveChannel takes the source and the medium; without the medium a
    // google/cpc lead files under Organic search.
    expect(leads).toContain("utm_source");
    expect(leads).toContain("utm_medium");
    expect(leads).toContain("metadata");
  });
});
