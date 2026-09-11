import { describe, expect, it } from "vitest";
import {
  CHATBOT_CHANNEL,
  resolveChannel,
  resolveDestination,
  UNKNOWN_CHANNEL,
  UNKNOWN_DESTINATION,
  WEBSITE_CHANNEL,
} from "./channel";

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

describe("chatbot channel", () => {
  it("gives an untagged chatbot capture its own channel", () => {
    expect(resolveChannel(null, { capturedByChatbot: true })).toEqual({
      channel: CHATBOT_CHANNEL,
      person: null,
    });
  });

  it("still calls an untagged non-chatbot lead Website", () => {
    expect(resolveChannel(null)).toEqual({
      channel: WEBSITE_CHANNEL,
      person: null,
    });
    expect(resolveChannel(null, { capturedByChatbot: false })).toEqual({
      channel: WEBSITE_CHANNEL,
      person: null,
    });
  });

  it("keeps the real campaign when a chatbot lead arrived from one", () => {
    // Instagram brought them; the chatbot only caught them. Crediting the
    // chatbot here would quietly shrink Instagram.
    expect(resolveChannel("mike-ig", { capturedByChatbot: true })).toEqual({
      channel: "Instagram",
      person: "Mike",
    });
  });

  it("resolves an explicitly chatbot-tagged link", () => {
    expect(resolveChannel("chatbot").channel).toBe(CHATBOT_CHANNEL);
  });
});

describe("resolveChannel with link-standard sources", () => {
  it("keeps paid platforms apart from their organic namesakes", () => {
    expect(resolveChannel("meta_ads").channel).toBe("Meta Ads");
    expect(resolveChannel("facebook").channel).toBe("Meta");
    expect(resolveChannel("google_ads").channel).toBe("Google Ads");
  });

  it("names the GHL channels by what they are, not by the tool", () => {
    expect(resolveChannel("ghl_sms").channel).toBe("SMS");
    expect(resolveChannel("ghl_email").channel).toBe("Email");
    expect(resolveChannel("referral").channel).toBe("Referral");
  });
});

describe("resolveDestination", () => {
  it("returns a closed-list destination case-insensitively", () => {
    expect(resolveDestination("book-call")).toBe("book-call");
    expect(resolveDestination(" Webinar-Register ")).toBe("webinar-register");
  });

  it("marks a legacy keyword term as unknown instead of dropping it", () => {
    expect(resolveDestination("vending machine business")).toBe(
      UNKNOWN_DESTINATION,
    );
    expect(resolveDestination("")).toBe(UNKNOWN_DESTINATION);
    expect(resolveDestination(null)).toBe(UNKNOWN_DESTINATION);
  });
});
