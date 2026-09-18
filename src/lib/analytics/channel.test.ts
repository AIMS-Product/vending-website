import { describe, expect, it } from "vitest";
import {
  CHATBOT_CHANNEL,
  resolveChannel,
  resolveDestination,
  UNKNOWN_CHANNEL,
  UNKNOWN_DESTINATION,
  WEBSITE_CHANNEL,
  resolveGa4Channel,
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
    expect(resolveChannel("mike-tt")).toEqual({
      channel: "TikTok",
      person: "Mike",
    });
  });

  it("maps referrer hostnames onto channels and the rest onto Referral", () => {
    expect(resolveChannel("l.instagram.com").channel).toBe("Instagram");
    expect(resolveChannel("Youtube.com").channel).toBe("YouTube");
    expect(resolveChannel("t.co").channel).toBe("X");
    expect(resolveChannel("m.facebook.com").channel).toBe("Meta");
    expect(resolveChannel("bing").channel).toBe("Organic search");
    expect(resolveChannel("us.search.yahoo.com").channel).toBe(
      "Organic search",
    );
    expect(resolveChannel("google").channel).toBe("Organic search");
    expect(resolveChannel("chatgpt.com").channel).toBe("AI assistants");
    expect(resolveChannel("mail.google.com").channel).toBe("Email");
    expect(resolveChannel("vendhubhq.com").channel).toBe("Website");
    expect(resolveChannel("calendly.com").channel).toBe("Website");
    expect(resolveChannel("sidehustlenation.com").channel).toBe("Referral");
    expect(resolveChannel("(data not available)").channel).toBe("Unknown");
    expect(resolveChannel("ghl_form").channel).toBe("GHL forms");
  });

  it("names the DM setter and the low-ticket funnel, and reads blanks as Website", () => {
    expect(resolveChannel("ghl").channel).toBe("Instagram DM");
    expect(resolveChannel("manychat").channel).toBe("Instagram DM");
    expect(resolveChannel("ltf").channel).toBe("Low ticket funnel");
    for (const blank of ["(not set)", "(direct)", "(none)"]) {
      expect(resolveChannel(blank).channel).toBe(WEBSITE_CHANNEL);
    }
    expect(resolveChannel("(data not available)").channel).toBe("Unknown");
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

  it("reads a paid medium as the platform's ad channel", () => {
    expect(resolveChannel("google", { medium: "cpc" }).channel).toBe(
      "Google Ads",
    );
    expect(resolveChannel("google", { medium: "organic" }).channel).toBe(
      "Organic search",
    );
    expect(resolveChannel("google", { medium: null }).channel).toBe(
      "Organic search",
    );
    expect(resolveChannel("meta", { medium: "paid" }).channel).toBe("Meta Ads");
    expect(resolveChannel("meta", { medium: "social-paid" }).channel).toBe(
      "Meta Ads",
    );
    expect(resolveChannel("instagram", { medium: "setter" }).channel).toBe(
      "Instagram",
    );
    expect(resolveChannel("youtube", { medium: "cpc" }).channel).toBe(
      "YouTube",
    );
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

describe("resolveGa4Channel", () => {
  it("files a google session carrying a real campaign as Google Ads", () => {
    expect(resolveGa4Channel("google", "VP | W2 | Consideration").channel).toBe(
      "Google Ads",
    );
    expect(resolveGa4Channel("google", "24132629905").channel).toBe(
      "Google Ads",
    );
  });

  it("leaves GA4's own organic marker as organic search", () => {
    expect(resolveGa4Channel("google", "(organic)").channel).toBe(
      "Organic search",
    );
    expect(resolveGa4Channel("google", "(not set)").channel).toBe(
      "Organic search",
    );
    expect(resolveGa4Channel("google", null).channel).toBe("Organic search");
  });

  it("does not guess at Meta, where GA4 marks nothing", () => {
    // An Instagram bio link and an Instagram ad are indistinguishable on this
    // table, so the row keeps the channel resolveChannel gives it.
    expect(resolveGa4Channel("instagram", "link-in-bio").channel).toBe(
      "Instagram",
    );
    expect(resolveGa4Channel("meta", "ltf_buyers").channel).toBe("Meta");
  });

  it("passes everything else straight through", () => {
    expect(resolveGa4Channel("youtube", "whatever").channel).toBe("YouTube");
    expect(resolveGa4Channel("(direct)", "(not set)").channel).toBe("Website");
  });
});
