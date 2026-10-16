import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOrigin } from "./sources";

const facts = (over: Partial<Parameters<typeof resolveOrigin>[0]> = {}) => ({
  funnel: null,
  contactUtms: [],
  ...over,
});

describe("Dom's v2.6 source resolver", () => {
  it("reads Dom's rules.json byte for byte (his handoff's config SHA)", () => {
    const bytes = readFileSync(path.join(__dirname, "rules.v2.6.json"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "2a3343fd339133c62b7accba767893c0b297d4b0be2527c95ca111c84895942f",
    );
  });

  it("trusts a valid Funnel Name over anything else", () => {
    expect(
      resolveOrigin(
        facts({ funnel: "youtube", contactUtms: [{ source: "instagram" }] }),
      ),
    ).toEqual({ source: "YouTube", basis: "funnel" });
  });

  // v2.6 maps `website`, so chatbot + website now agree on Website; one
  // unmapped UTM beside them still leaves the source unresolved.
  it("leaves the source unresolved when any contact UTM is unmapped", () => {
    expect(
      resolveOrigin(
        facts({
          funnel: "Reactivation Scrapers",
          contactUtms: [{ source: "chatbot" }, { source: "website" }],
        }),
      ),
    ).toEqual({ source: "Website", basis: "contact_utm" });
    expect(
      resolveOrigin(
        facts({
          funnel: "Reactivation Scrapers",
          contactUtms: [{ source: "chatbot" }, { source: "partner-site" }],
        }),
      ),
    ).toEqual({ source: null, basis: "unknown" });
  });

  it("resolves agreeing contact UTMs, normalised as sources.py does", () => {
    expect(
      resolveOrigin(
        facts({
          contactUtms: [
            { source: " Google&utm_x=1" },
            { source: "google?gclid=abc" },
            { source: "" },
          ],
        }),
      ),
    ).toEqual({ source: "Google Ads", basis: "contact_utm" });
  });

  it("maps the v2.6 aliases and ignores utm_medium", () => {
    for (const [source, label] of [
      ["yt", "YouTube"],
      ["fb", "Meta Ads"],
      ["facebook", "Meta Ads"],
      ["ig", "Instagram"],
      ["internal_webinar", "Internal Webinar"],
      ["web", "Website"],
    ]) {
      expect(resolveOrigin(facts({ contactUtms: [{ source }] }))).toEqual({
        source: label,
        basis: "contact_utm",
      });
    }
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

  it("never falls back to anything but contact utm_source", () => {
    expect(resolveOrigin(facts())).toEqual({ source: null, basis: "unknown" });
  });
});
