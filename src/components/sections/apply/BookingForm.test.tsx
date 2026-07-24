import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BookingForm } from "./BookingForm";
import { emptyLeadAttribution } from "@/lib/lead-attribution";

// PublicLeadForm calls useRouter(); SSR has no app-router context.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
// The booking action is a "use server" module; the form only needs a reference.
vi.mock("@/app/booking/actions", () => ({
  submitBookingLead: async () => ({ status: "idle" as const }),
}));

const attribution = emptyLeadAttribution("/booking-ak-t5");

function render() {
  return renderToStaticMarkup(
    createElement(BookingForm, {
      attribution,
      idempotencyKey: "booking-test",
      calendlyUrl:
        "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call",
    }),
  );
}

describe("BookingForm", () => {
  it("uses the Book Your Call header and Submit button", () => {
    const html = render();
    expect(html).toContain("Book Your Call");
    expect(html).toContain(">Submit<");
  });

  it("collects only contact details (name, email, phone)", () => {
    const html = render();
    expect(html).toContain('name="full_name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="phone"');
  });

  it("drops the qualifying dropdowns and message field", () => {
    const html = render();
    for (const field of [
      'name="business_stage"',
      'name="budget"',
      'name="timeline"',
      'name="city"',
      'name="state_region"',
      'name="message"',
    ]) {
      expect(html).not.toContain(field);
    }
  });
});
