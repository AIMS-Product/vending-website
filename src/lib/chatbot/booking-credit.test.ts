import { describe, expect, it } from "vitest";
import { resolveBookingCredit } from "./booking-credit";

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
