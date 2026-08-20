import { describe, expect, it } from "vitest";
import { resolveChannel, UNKNOWN_CHANNEL, WEBSITE_CHANNEL } from "./channel";

describe("resolveChannel", () => {
  it("merges the capitalisation split that was under-reporting Instagram", () => {
    // Production held "Instagram" (28) and "instagram" (6) as separate rows.
    expect(resolveChannel("Instagram").channel).toBe("Instagram");
    expect(resolveChannel("instagram").channel).toBe("Instagram");
    expect(resolveChannel("  INSTAGRAM  ").channel).toBe("Instagram");
  });

  it("merges Facebook into Meta", () => {
    expect(resolveChannel("FaceBook").channel).toBe("Meta");
    expect(resolveChannel("meta").channel).toBe("Meta");
  });

  it("rolls a person-tagged link into its platform and keeps the person", () => {
    expect(resolveChannel("mike-ig")).toEqual({
      channel: "Instagram",
      person: "Mike",
    });
    expect(resolveChannel("anthony-li")).toEqual({
      channel: "LinkedIn",
      person: "Anthony",
    });
    expect(resolveChannel("mike-x")).toEqual({ channel: "X", person: "Mike" });
  });

  it("handles a person tag it has never seen before", () => {
    // A new rep's link must not open its own row and shrink the channel.
    expect(resolveChannel("sarah-ig")).toEqual({
      channel: "Instagram",
      person: "Sarah",
    });
    expect(resolveChannel("dave_youtube")).toEqual({
      channel: "YouTube",
      person: "Dave",
    });
  });

  it("treats an untagged lead as Website", () => {
    for (const value of [null, undefined, "", "   "]) {
      expect(resolveChannel(value)).toEqual({
        channel: WEBSITE_CHANNEL,
        person: null,
      });
    }
  });

  it("folds the vendingpreneurs.ai funnel tag into Website", () => {
    expect(resolveChannel("web").channel).toBe(WEBSITE_CHANNEL);
  });

  it("does not bury an unrecognised campaign tag in Website", () => {
    // Overstating the site would be worse than an extra row.
    expect(resolveChannel("mystery-partner").channel).toBe("Mystery Partner");
    expect(resolveChannel("internal-webinar").channel).toBe("Webinar");
  });

  it("flags a punctuation-only tag rather than counting it as Website", () => {
    expect(resolveChannel("_____").channel).toBe(UNKNOWN_CHANNEL);
  });
});
