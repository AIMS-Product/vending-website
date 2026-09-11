import { describe, expect, it } from "vitest";
import { resolveBookingCredit, resolveFirstTouch } from "./booking-credit";

describe("resolveFirstTouch", () => {
  const CHAT_AT = "2026-09-06T17:42:00.000Z";

  it("credits the chatbot when Close only created the lead after the chat started", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: "2026-09-06T17:50:00.000Z",
        entryResourceTag: "chatbot",
      }),
    ).toEqual({ kind: "chatbot", label: "Chatbot" });
  });

  it("makes the chat a middle touch when Close already had them from a webinar", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: "2026-08-28T02:01:04.000Z",
        entryResourceTag: "internal-webinar",
      }),
    ).toEqual({
      kind: "earlier",
      label: "Internal webinar",
      at: "2026-08-28T02:01:04.000Z",
    });
  });

  it("keeps the chatbot first when the earlier Close record came from an earlier chat", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: "2026-08-28T22:56:45.000Z",
        entryResourceTag: "chatbot",
      }).kind,
    ).toBe("chatbot");
  });

  it("orders by time, so a form filled after the chat does not take first touch", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: "2026-09-06T18:05:00.000Z",
        entryResourceTag: "website-application",
      }).kind,
    ).toBe("chatbot");
  });

  it("names an untagged earlier record without inventing a source", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: "2025-12-05T21:45:26.000Z",
        entryResourceTag: null,
      }),
    ).toEqual({
      kind: "earlier",
      label: "An earlier source",
      at: "2025-12-05T21:45:26.000Z",
    });
  });

  it("says not checked yet, never chatbot, before Close has been read", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: true,
        closeLeadCreatedAt: null,
        entryResourceTag: "chatbot",
      }),
    ).toEqual({ kind: "unknown", label: "Not checked yet" });
  });

  it("separates a chat with no lead at all from one still waiting on Close", () => {
    // Both used to render as "Not checked yet", which promised an answer that
    // could never arrive: with no lead there is nothing for the reconciler to
    // read. The Booked view counted these as pending forever.
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: false,
        closeLeadCreatedAt: null,
        entryResourceTag: null,
      }),
    ).toEqual({ kind: "unlinked", label: "No lead linked" });
  });

  it("never credits the chatbot off a stale date when no lead is linked", () => {
    expect(
      resolveFirstTouch({
        conversationCreatedAt: CHAT_AT,
        leadLinked: false,
        closeLeadCreatedAt: "2026-09-06T17:50:00.000Z",
        entryResourceTag: "chatbot",
      }).kind,
    ).toBe("unlinked");
  });
});

describe("resolveBookingCredit", () => {
  it("credits the chatbot only when the chat calendar's own utm came back", () => {
    expect(
      resolveBookingCredit({
        attributionSource: "in_chat",
        bookedBySetter: null,
      }),
    ).toEqual({ kind: "in_chat", label: "Booked in chat", setter: null });
  });

  it("credits the setter on an email match -- the Gerald Winslow case", () => {
    expect(
      resolveBookingCredit({
        attributionSource: "email_match",
        bookedBySetter: "Connor George",
      }),
    ).toEqual({
      kind: "setter",
      label: "Set by Connor George",
      setter: "Connor George",
    });
  });

  it("never claims the chatbot booked a call it only sourced", () => {
    const credit = resolveBookingCredit({
      attributionSource: "email_match",
      bookedBySetter: null,
    });
    expect(credit).toEqual({
      kind: "unknown",
      label: "Booked elsewhere",
      setter: null,
    });
    expect(credit.label).not.toContain("chat");
  });

  it("treats an unrecorded attribution source as unknown, not as in-chat", () => {
    expect(
      resolveBookingCredit({ attributionSource: null, bookedBySetter: null })
        .kind,
    ).toBe("unknown");
  });

  it("keeps the setter visible on an in-chat booking instead of hiding it", () => {
    expect(
      resolveBookingCredit({
        attributionSource: "in_chat",
        bookedBySetter: "Pearl Sathekge",
      }),
    ).toEqual({
      kind: "in_chat",
      label: "Booked in chat",
      setter: "Pearl Sathekge",
    });
  });

  it("ignores a blank setter field rather than crediting an empty name", () => {
    expect(
      resolveBookingCredit({
        attributionSource: "email_match",
        bookedBySetter: "   ",
      }),
    ).toEqual({ kind: "unknown", label: "Booked elsewhere", setter: null });
  });
});
