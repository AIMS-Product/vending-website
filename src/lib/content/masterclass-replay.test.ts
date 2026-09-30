import { describe, expect, it } from "vitest";
import {
  REPLAY_ADVISORY_CALENDLY,
  REPLAY_EXPIRES_AT,
  REPLAY_L1_BOOKING_CALENDLY,
  REPLAY_MAIN_VIDEO,
  REPLAY_PATHS,
  replayTestimonials,
  replayVariants,
  type ReplayVariantKey,
} from "./masterclass-replay";

const KEYS = Object.keys(replayVariants) as ReplayVariantKey[];

describe("masterclass replay content", () => {
  it("has four variants, each with a main video and five testimonial videos", () => {
    expect(KEYS.sort()).toEqual(["adnb", "advisory", "dna", "meta"]);
    for (const key of KEYS) {
      const variant = replayVariants[key];
      expect(variant.mainVideo).toEqual(REPLAY_MAIN_VIDEO);
      expect(variant.testimonialVideos).toHaveLength(replayTestimonials.length);
      expect(variant.path).toBe(REPLAY_PATHS[key]);
    }
  });

  it("uses the Vidalytics main video GHL embeds on every replay page", () => {
    expect(REPLAY_MAIN_VIDEO).toEqual({
      kind: "vidalytics",
      embedId: "cARihXjwCxR3xiJ0",
    });
  });

  it("matches the GHL booking destination per variant", () => {
    // DNA and meta: GHL form "Lead Scoring -> Book a Call", every score band
    // redirects to /book-my-advisory-call-l1-topcl (this Calendly).
    for (const key of ["dna", "meta"] as const) {
      expect(replayVariants[key].cta?.action).toEqual({
        kind: "form",
        calendlyUrl:
          "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call",
      });
    }
    expect(REPLAY_L1_BOOKING_CALENDLY).toContain("cvr6-cfd-zgd");
    // ADNB: inline Calendly embed.
    expect(replayVariants.adnb.cta?.action).toEqual({
      kind: "calendly",
      calendlyUrl:
        "https://calendly.com/d/cxwj-zxk-2z4/vending-route-advisory-call",
    });
    expect(REPLAY_ADVISORY_CALENDLY).toContain("cxwj-zxk-2z4");
    // Advisory: no booking section; its button scrolls to the replay.
    expect(replayVariants.advisory.cta).toBeNull();
    expect(replayVariants.advisory.closing?.target).toBe("video");
  });

  it("uses the GHL testimonial video ids (YouTube, or Vidalytics on meta)", () => {
    const ids = (key: ReplayVariantKey) =>
      replayVariants[key].testimonialVideos.map((v) =>
        v.kind === "youtube" ? v.id : v.embedId,
      );
    expect(ids("dna")).toEqual([
      "U7KKbZHqBvg",
      "yP4Y_BBAvq4",
      "heSbv_uG734",
      "gvvz2nMax0w",
      "io1Jkei-yFs",
    ]);
    expect(ids("adnb")).toEqual(ids("dna"));
    expect(ids("advisory")).toEqual(ids("dna"));
    expect(ids("meta")).toEqual([
      "JcjYb4jILP6zsniI",
      "OHz6S1sB3ahBvu8D",
      "LchE9_kgP012adAZ",
      "U1unfH4Jvr6TjBrS",
      "5IT3tUDRQOJfSJ2m",
    ]);
  });

  it("expires 2026-10-04 23:00 America/Chicago, as the GHL countdown", () => {
    expect(REPLAY_EXPIRES_AT).toBe("2026-10-05T04:00:00.000Z");
  });

  it("carries no emoji", () => {
    const text = JSON.stringify([replayVariants, replayTestimonials]);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
