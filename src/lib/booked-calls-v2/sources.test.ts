import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOrigin } from "./sources";

const facts = (over: Partial<Parameters<typeof resolveOrigin>[0]> = {}) => ({
  funnel: null,
  contactUtms: [],
  resourceTag: null,
  ...over,
});

describe("Dom's v2.2 source resolver", () => {
  it("reads Dom's rules.json byte for byte (his memo's config SHA)", () => {
    const bytes = readFileSync(path.join(__dirname, "rules.v2.2.json"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "6949a5ee62fb387c569f1536fe63e65c64dc0d347c93560e422202aa894b581a",
    );
  });

  it("trusts a valid Funnel Name over anything else", () => {
    expect(
      resolveOrigin(
        facts({ funnel: "youtube", contactUtms: [{ source: "instagram" }] }),
      ),
    ).toEqual({ source: "YouTube", basis: "funnel" });
  });

  // Dom's certified Oct 1-13 pull held this meeting (redacted_479e3a74ad5a):
  // one contact mapped to Website-ish evidence, another carried an unmapped
  // UTM. Our stand-in resolver counted it as Marketing (85 vs his 84).
  it("leaves the source unresolved when any contact UTM is unmapped", () => {
    expect(
      resolveOrigin(
        facts({
          funnel: "Reactivation Scrapers",
          contactUtms: [{ source: "chatbot" }, { source: "website" }],
        }),
      ),
    ).toEqual({ source: null, basis: "unknown" });
  });

  it("resolves agreeing contact UTMs, normalised as sources.py does", () => {
    expect(
      resolveOrigin(
        facts({
          contactUtms: [
            { source: " Google&utm_x=1", medium: "cpc" },
            { source: "google?gclid=abc" },
            { source: "" },
          ],
        }),
      ),
    ).toEqual({ source: "Google Ads", basis: "contact_utm" });
  });

  it("applies a medium override before the source map", () => {
    expect(
      resolveOrigin(
        facts({
          contactUtms: [{ source: "instagram", medium: "Organic-Social" }],
        }),
      ),
    ).toEqual({ source: "Anthony IG", basis: "contact_utm" });
  });

  it("holds conflicting contacts rather than picking one", () => {
    expect(
      resolveOrigin(
        facts({
          contactUtms: [{ source: "youtube" }, { source: "instagram" }],
        }),
      ),
    ).toEqual({ source: null, basis: "unknown" });
  });

  it("falls back to Resource Tag only with no UTM evidence", () => {
    expect(
      resolveOrigin(facts({ resourceTag: "website-application" })),
    ).toEqual({ source: "Website", basis: "resource_tag" });
    expect(resolveOrigin(facts({ resourceTag: "internal-webinar" }))).toEqual({
      source: null,
      basis: "unknown",
    });
    expect(
      resolveOrigin(
        facts({ resourceTag: "newsletter", contactUtms: [{ source: "web" }] }),
      ),
    ).toEqual({ source: null, basis: "unknown" });
  });
});
