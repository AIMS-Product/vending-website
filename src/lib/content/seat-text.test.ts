import { describe, expect, it } from "vitest";
import { seatTextBody, seatTextHref } from "@/lib/content/masterclass";

describe("seat confirmation text", () => {
  it("names the person and the room date in Central time", () => {
    expect(seatTextBody("Jess", "2026-10-28T00:30:00Z")).toBe(
      "Hi Anthony, it's Jess. I saved my seat for the masterclass on Tue, Oct 27. Text me here before we go live.",
    );
  });
  it("still reads without a name or date", () => {
    expect(seatTextBody(null, null)).toBe(
      "Hi Anthony! I saved my seat for the masterclass. Text me here before we go live.",
    );
  });
  it("builds an sms link to the GHL number with the body encoded", () => {
    expect(seatTextHref("Hi & bye")).toBe("sms:+15412369273?&body=Hi%20%26%20bye");
  });
});
