import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BookingLandingPage } from "./BookingLandingPage";
import { bookingPages } from "@/lib/content/booking-pages";
import { emptyLeadAttribution } from "@/lib/lead-attribution";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/app/booking/actions", () => ({
  submitBookingLead: async () => ({ status: "idle" as const }),
}));

function renderPage(slug: keyof typeof bookingPages) {
  return renderToStaticMarkup(
    createElement(BookingLandingPage, {
      config: bookingPages[slug],
      attribution: emptyLeadAttribution(`/${slug}`),
      idempotencyKey: `test-${slug}`,
    }),
  );
}

describe("BookingLandingPage", () => {
  it("swaps every CTA to Book Your Call", () => {
    const html = renderPage("booking-t5-socials");
    expect(html).toContain("Book Your Call");
    // The apply-page default CTA must not survive on a booking page.
    expect(html).not.toContain("I'm Ready to Build My Route");
  });

  it("renders Mike's copy + VSL for the default persona", () => {
    const html = renderPage("booking-t5-socials");
    expect(html).toContain("P-Z1BZ9M-Fg"); // Mike VSL thumbnail
    expect(html).toContain("Mike Hoffmann");
    expect(html).not.toContain("ksvldfarH-U");
  });

  it("renders Anthony's copy + VSL for the -ak- pages", () => {
    const html = renderPage("booking-ak-t5");
    expect(html).toContain("ksvldfarH-U"); // Anthony VSL thumbnail
    expect(html).toContain("Anthony Kolodziej");
    expect(html).toContain(
      "the same playbook, systems, and scripts Anthony used",
    );
    expect(html).not.toContain("P-Z1BZ9M-Fg");
  });
});
