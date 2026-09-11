import { describe, expect, it } from "vitest";
import {
  buildStandardLink,
  checkLinkStandard,
  linkStandardSchema,
  parseLinkUtms,
} from "./link-standard";

const valid = {
  baseUrl: "https://www.vendingpreneurs.com/book?ref=bio",
  source: "instagram",
  medium: "organic",
  campaign: "webinar-sept15",
  content: "post-2026-09-11",
  destination: "webinar-register",
} as const;

describe("linkStandardSchema", () => {
  it("accepts a link on the standard", () => {
    expect(linkStandardSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a source, medium or destination off the closed lists", () => {
    expect(
      linkStandardSchema.safeParse({ ...valid, source: "IG" }).success,
    ).toBe(false);
    expect(
      linkStandardSchema.safeParse({ ...valid, medium: "cpc" }).success,
    ).toBe(false);
    expect(
      linkStandardSchema.safeParse({ ...valid, destination: "homepage" })
        .success,
    ).toBe(false);
  });

  it("rejects a campaign that is not a lowercase slug", () => {
    expect(
      linkStandardSchema.safeParse({ ...valid, campaign: "Webinar Sept" })
        .success,
    ).toBe(false);
  });

  it("allows a YouTube video id as content", () => {
    expect(
      linkStandardSchema.safeParse({ ...valid, content: "dQw4w9WgXcQ" })
        .success,
    ).toBe(true);
  });

  it("insists on https", () => {
    expect(
      linkStandardSchema.safeParse({
        ...valid,
        baseUrl: "http://www.vendingpreneurs.com/",
      }).success,
    ).toBe(false);
  });
});

describe("buildStandardLink", () => {
  it("writes the five UTMs and keeps unrelated query params", () => {
    const url = new URL(buildStandardLink(valid));
    expect(url.searchParams.get("ref")).toBe("bio");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("utm_medium")).toBe("organic");
    expect(url.searchParams.get("utm_campaign")).toBe("webinar-sept15");
    expect(url.searchParams.get("utm_content")).toBe("post-2026-09-11");
    expect(url.searchParams.get("utm_term")).toBe("webinar-register");
  });

  it("replaces a stale UTM already on the pasted URL", () => {
    const url = new URL(
      buildStandardLink({
        ...valid,
        baseUrl: "https://www.vendingpreneurs.com/book?utm_source=old",
      }),
    );
    expect(url.searchParams.getAll("utm_source")).toEqual(["instagram"]);
  });
});

describe("parseLinkUtms", () => {
  it("reads the UTMs off a link and nulls the absent ones", () => {
    expect(
      parseLinkUtms("https://x.test/p?utm_source=youtube&utm_campaign=vsl"),
    ).toEqual({
      source: "youtube",
      medium: null,
      campaign: "vsl",
      content: null,
      term: null,
    });
  });

  it("returns null for something that is not a URL", () => {
    expect(parseLinkUtms("not a url")).toBeNull();
    expect(parseLinkUtms(null)).toBeNull();
  });
});

describe("checkLinkStandard", () => {
  it("passes a link built by the builder", () => {
    expect(checkLinkStandard(buildStandardLink(valid))).toEqual({
      compliant: true,
      problems: [],
    });
  });

  it("names every missing or off-list value in plain English", () => {
    const result = checkLinkStandard(
      "https://x.test/p?utm_source=IG&utm_term=homepage",
    );
    expect(result.compliant).toBe(false);
    expect(result.problems).toEqual([
      'utm_source "IG" is not on the source list.',
      "utm_medium is missing.",
      "utm_campaign is missing.",
      "utm_content is missing.",
      'utm_term "homepage" is not a destination (book-call, lead-magnet, webinar-register, apply, content, none).',
    ]);
  });

  it("treats case differences as compliant, matching resolveChannel", () => {
    expect(
      checkLinkStandard(
        "https://x.test/?utm_source=YouTube&utm_medium=Organic&utm_campaign=a&utm_content=b&utm_term=Book-Call",
      ).compliant,
    ).toBe(true);
  });
});
