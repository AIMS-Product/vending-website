import { describe, expect, it } from "vitest";
import {
  REPLAY_ADVISORY_CALENDLY,
  REPLAY_GHL_FORM_SRC,
  replayExpiry,
  REPLAY_L1_BOOKING_CALENDLY,
  REPLAY_MAIN_VIDEO,
  REPLAY_META_TITLE,
  REPLAY_PATHS,
  replayCountdownLive,
  replayDescription,
  replayTestimonialCards,
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
    // DNA and meta: the GHL form itself ("Lead Scoring -> Book a Call"); GHL
    // redirects every score band to /book-my-advisory-call-l1-topcl.
    for (const key of ["dna", "meta"] as const) {
      expect(replayVariants[key].cta?.action).toEqual({ kind: "ghl-form" });
    }
    // DNA's and meta's form copy names the call their steps, hero and
    // buttons offer, never GHL's "Strategy Call".
    for (const key of ["dna", "meta"] as const) {
      const copy = replayVariants[key].cta?.paragraphs
        .flatMap((p) => p.lines)
        .join(" ");
      expect(copy).toContain("schedule your free advisory call");
      expect(copy).not.toContain("Strategy Call");
    }
    expect(REPLAY_GHL_FORM_SRC).toBe(
      "https://api.leadconnectorhq.com/widget/form/0vrICJhXXOmSC9aGHj3P",
    );
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
    // Same order as replayTestimonials: Michael, Joe, Shannon, Mallorie,
    // Katie + Graham.
    expect(replayTestimonials.map((t) => t.name)).toEqual([
      "Michael",
      "Joe",
      "Shannon",
      "Mallorie",
      "Katie + Graham",
    ]);
    expect(ids("dna")).toEqual([
      "U7KKbZHqBvg",
      "gvvz2nMax0w",
      "yP4Y_BBAvq4",
      "io1Jkei-yFs",
      "heSbv_uG734",
    ]);
    expect(ids("adnb")).toEqual(ids("dna"));
    expect(ids("advisory")).toEqual(ids("dna"));
    expect(ids("meta")).toEqual([
      "JcjYb4jILP6zsniI",
      "U1unfH4Jvr6TjBrS",
      "OHz6S1sB3ahBvu8D",
      "5IT3tUDRQOJfSJ2m",
      "LchE9_kgP012adAZ",
    ]);
  });

  it("orders every variant's cards Michael, Joe, Mallorie / Shannon, Katie + Graham, videos following", () => {
    const names = (key: ReplayVariantKey) =>
      replayTestimonialCards(replayVariants[key]).map((c) => c.item.name);
    for (const key of KEYS) {
      expect(names(key)).toEqual([
        "Michael",
        "Joe",
        "Mallorie",
        "Shannon",
        "Katie + Graham",
      ]);
    }
    // Each card keeps its own member's video after the reorder.
    for (const key of KEYS) {
      const variant = replayVariants[key];
      for (const card of replayTestimonialCards(variant)) {
        const index = replayTestimonials.indexOf(card.item);
        expect(card.video).toBe(variant.testimonialVideos[index]);
      }
    }
  });

  it("gives every Vidalytics testimonial a poster: the same member's full-size YouTube thumbnail", () => {
    const youtubeIds = replayVariants.dna.testimonialVideos.map((v) =>
      v.kind === "youtube" ? v.id : null,
    );
    for (const key of KEYS) {
      replayVariants[key].testimonialVideos.forEach((video, index) => {
        if (video.kind !== "vidalytics") return;
        expect(video.poster).toBe(
          `https://i.ytimg.com/vi/${youtubeIds[index]}/maxresdefault.jpg`,
        );
      });
    }
    expect(
      replayVariants.meta.testimonialVideos.every(
        (v) => v.kind === "vidalytics" && Boolean(v.poster),
      ),
    ).toBe(true);
  });

  it("links the DNA booking step and closes meta with a CTA to the form", () => {
    expect(replayVariants.dna.steps.map((s) => s.label)).toEqual([
      "Watch the replay",
      "Book your free advisory call below",
    ]);
    expect(replayVariants.dna.steps[1].target).toBe("cta");
    expect(replayVariants.meta.closing).toEqual({
      label: "Book my free advisory call",
      target: "cta",
    });
  });

  it("names the call one way on every variant: a free advisory call", () => {
    const copy = JSON.stringify(replayVariants).toLowerCase();
    expect(copy).not.toContain("strategy call");
    for (const key of ["dna", "adnb", "meta"] as const) {
      expect(replayVariants[key].closing?.label).toBe(
        "Book my free advisory call",
      );
    }
  });

  it("expires the Sunday before the event at 9 PM America/Chicago", () => {
    // Oct 6 2026 7:30 PM CDT (Tuesday) -> Sun Oct 4 21:00 CDT.
    expect(replayExpiry("2026-10-07T00:30:00.000Z")).toBe(
      "2026-10-05T02:00:00.000Z",
    );
    // Across the Nov 1 DST end: Tue Nov 3 -> Sun Nov 1 21:00 CST (UTC-6).
    expect(replayExpiry("2026-11-04T01:30:00.000Z")).toBe(
      "2026-11-02T03:00:00.000Z",
    );
    // Just before the change: Tue Oct 27 -> Sun Oct 25 21:00 CDT (UTC-5).
    expect(replayExpiry("2026-10-28T00:30:00.000Z")).toBe(
      "2026-10-26T02:00:00.000Z",
    );
    // After: Tue Nov 10 -> Sun Nov 8 21:00 CST.
    expect(replayExpiry("2026-11-11T01:30:00.000Z")).toBe(
      "2026-11-09T03:00:00.000Z",
    );
    // Sunday event -> the prior Sunday. Mar 2027 spring forward: Tue Mar 16.
    expect(replayExpiry("2027-03-17T00:30:00.000Z")).toBe(
      "2027-03-15T02:00:00.000Z",
    );
  });

  it("shows the expiry strip only while the expiry is ahead, never an 'ended' state", () => {
    const expiry = "2026-10-05T04:00:00.000Z";
    const at = Date.parse(expiry);
    expect(replayCountdownLive(expiry, at - 1000)).toBe(true);
    // At and after the expiry the replay still plays: no strip at all.
    expect(replayCountdownLive(expiry, at)).toBe(false);
    expect(replayCountdownLive(expiry, at + 86_400_000)).toBe(false);
    expect(replayCountdownLive(null, at)).toBe(false);
    expect(replayCountdownLive("not a date", at)).toBe(false);
  });

  it("tells the variants apart by tab title, and describes each from its page copy", () => {
    // Tabs name the page's offer; the audience key (DNA, ADNB, Meta) never
    // reaches a tab, and every share preview stays "Masterclass Replay".
    for (const key of ["dna", "adnb", "meta"] as const) {
      expect(replayVariants[key].metaTitle).toBe(
        "Masterclass Replay: Book Your Call",
      );
    }
    expect(replayVariants.advisory.metaTitle).toBe(
      "Masterclass Replay: Advisory",
    );
    expect(REPLAY_META_TITLE).toBe("Masterclass Replay");
    for (const key of KEYS) {
      const variant = replayVariants[key];
      const description = replayDescription(variant);
      expect(description).toContain(variant.sub.join(" "));
      expect(description.length).toBeGreaterThanOrEqual(80);
    }
    expect(replayDescription(replayVariants.advisory)).toBe(
      "See How Professionals Are Building an Additional Income Stream With Vending. This replay will only be available for a limited time.",
    );
  });

  it("returns null (countdown hidden) without a usable start", () => {
    expect(replayExpiry(null)).toBeNull();
    expect(replayExpiry("not a date")).toBeNull();
  });

  it("carries no emoji", () => {
    const text = JSON.stringify([replayVariants, replayTestimonials]);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
