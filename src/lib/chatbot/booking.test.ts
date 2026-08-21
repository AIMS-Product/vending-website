import { describe, expect, it } from "vitest";
import { chatbotBookingUrl, CHATBOT_BOOKING_URL } from "./booking";

/**
 * The utm_source/utm_content pair on these URLs IS the attribution chain —
 * Calendly echoes them back on the webhook and booking-attribution.ts matches
 * on them. If these assertions break, booked-call reporting silently reports
 * zero.
 */
describe("chatbotBookingUrl", () => {
  it("tags the URL with the conversation id so the webhook can match it", () => {
    const url = new URL(
      chatbotBookingUrl({ conversationId: "conv-123" }) as string,
    );
    expect(url.searchParams.get("utm_source")).toBe("chatbot");
    expect(url.searchParams.get("utm_content")).toBe("conv-123");
  });

  it("prefills known contact details and omits unknown ones", () => {
    const url = new URL(
      chatbotBookingUrl({
        conversationId: "conv-123",
        name: " Dana ",
        email: null,
      }) as string,
    );
    expect(url.searchParams.get("name")).toBe("Dana");
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("adds inline embed params only when embedding", () => {
    const plain = new URL(chatbotBookingUrl({ conversationId: "c" }) as string);
    expect(plain.searchParams.has("embed_type")).toBe(false);

    const embedded = new URL(
      chatbotBookingUrl({
        conversationId: "c",
        embed: true,
        embedDomain: "www.vendingpreneurs.com",
      }) as string,
    );
    expect(embedded.searchParams.get("embed_type")).toBe("Inline");
    expect(embedded.searchParams.get("embed_domain")).toBe(
      "www.vendingpreneurs.com",
    );
  });

  it("keeps the configured booking destination intact", () => {
    const url = new URL(chatbotBookingUrl({ conversationId: "c" }) as string);
    expect(`${url.origin}${url.pathname}`).toBe(
      `${new URL(CHATBOT_BOOKING_URL).origin}${new URL(CHATBOT_BOOKING_URL).pathname}`,
    );
  });
});
