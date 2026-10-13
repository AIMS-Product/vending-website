import { describe, expect, it } from "vitest";
import {
  IMPORTED_LINK_PREFIX as SCRIPT_PREFIX,
  cleanTag,
  mergeCandidates,
  splitUrl,
  toRow,
  tupleKey,
} from "./marketing-link-backfill.mjs";
import {
  IMPORTED_LINK_PREFIX,
  utmTupleKey,
} from "../../src/lib/analytics/link-standard";

const tuple = (over = {}) => ({
  source: "youtube",
  medium: "video",
  campaign: "pro-con",
  content: "desc-link-1",
  term: null,
  ...over,
});

describe("marketing link backfill", () => {
  it("keys links exactly like the app", () => {
    const t = tuple({ source: "YouTube " });
    expect(tupleKey(t)).toBe(utmTupleKey(t));
    const filler = tuple({ term: "_____", content: "{{x}}" });
    expect(tupleKey(filler)).toBe(utmTupleKey(filler));
    expect(SCRIPT_PREFIX).toBe(IMPORTED_LINK_PREFIX);
  });

  it("treats template filler as no tag", () => {
    expect(cleanTag("_____")).toBeNull();
    expect(cleanTag("{{contact.id}}")).toBeNull();
    expect(cleanTag("  ")).toBeNull();
    expect(cleanTag(" sept14 ")).toBe("sept14");
  });

  it("splits a long URL into its tags and a clean base", () => {
    expect(
      splitUrl(
        "https://www.vendingpreneurs.com/booking-youtube?utm_source=youtube&utm_medium=video&utm_campaign=pro-con&utm_content=desc-link-1&ref=x",
      ),
    ).toEqual({
      tuple: tuple(),
      baseUrl: "https://www.vendingpreneurs.com/booking-youtube?ref=x",
    });
    expect(splitUrl("not a url")).toBeNull();
  });

  it("keeps one row per link: the best origin, the earliest sighting, nothing already registered", () => {
    const merged = mergeCandidates(
      [
        {
          origin: "leads",
          tuple: tuple(),
          baseUrl: "https://a.test/",
          firstSeen: "2026-08-01",
        },
        {
          origin: "youtube",
          tuple: tuple({ source: "youtube" }),
          baseUrl: "https://b.test/",
          bitlyUrl: "https://b.test/s",
          firstSeen: "2026-09-01",
        },
        {
          origin: "leads",
          tuple: tuple({ campaign: "known" }),
          baseUrl: "https://a.test/",
        },
        {
          origin: "calendly",
          tuple: tuple({ source: "qa" }),
          baseUrl: "https://c.test/",
        },
        {
          origin: "calendly",
          tuple: {
            source: null,
            medium: null,
            campaign: null,
            content: null,
            term: null,
          },
          baseUrl: "https://c.test/",
        },
      ],
      new Set([tupleKey(tuple({ campaign: "known" }))]),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      origin: "youtube",
      baseUrl: "https://b.test/",
      firstSeen: "2026-08-01",
    });
  });

  it("refuses tags no link of ours could carry, and reports duplicate short links", () => {
    const drops = [];
    const merged = mergeCandidates(
      [
        {
          origin: "leads",
          tuple: tuple({ campaign: "<script>" }),
          baseUrl: "https://a.test/",
        },
        {
          origin: "leads",
          tuple: tuple({ content: "x".repeat(121) }),
          baseUrl: "https://a.test/",
        },
        {
          origin: "webinar-links",
          tuple: tuple(),
          baseUrl: "https://a.test/",
          bitlyUrl: "https://s/1",
        },
        {
          origin: "webinar-links",
          tuple: tuple(),
          baseUrl: "https://a.test/",
          bitlyUrl: "https://s/2",
        },
      ],
      new Set(),
      (candidate, why) => drops.push(`${candidate.bitlyUrl ?? "-"} ${why}`),
    );
    expect(merged).toHaveLength(1);
    expect(drops).toEqual([
      "- implausible tag",
      "- implausible tag",
      "https://s/2 same tags as https://s/1",
    ]);
  });

  it("writes empty strings for missing tags and marks the row imported", () => {
    const row = toRow({
      origin: "youtube",
      tuple: tuple(),
      baseUrl: "https://b.test/x",
    });
    expect(row).toMatchObject({
      url: "https://b.test/x?utm_source=youtube&utm_medium=video&utm_campaign=pro-con&utm_content=desc-link-1",
      utm_term: "",
      created_by: "backfill:youtube",
    });
  });
});
