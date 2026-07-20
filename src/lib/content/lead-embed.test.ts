import { describe, expect, it } from "vitest";
import {
  buildCalendlyBookingUrl,
  isCalendlyUrl,
} from "@/lib/content/lead-embed";
import type { LeadAttribution } from "@/lib/lead-attribution";

const attribution: LeadAttribution = {
  utm_source: "youtube",
  utm_medium: "video",
  utm_campaign: "spring",
} as LeadAttribution;

describe("buildCalendlyBookingUrl", () => {
  it("pre-fills name and email from the submitted values", () => {
    const url = new URL(
      buildCalendlyBookingUrl("https://calendly.com/team/intro", {
        name: "Jane Vendor",
        email: "jane@example.com",
      }),
    );
    expect(url.searchParams.get("name")).toBe("Jane Vendor");
    expect(url.searchParams.get("email")).toBe("jane@example.com");
  });

  it("carries UTM attribution through to the scheduler", () => {
    const url = new URL(
      buildCalendlyBookingUrl("https://calendly.com/team/intro", {
        attribution,
      }),
    );
    expect(url.searchParams.get("utm_source")).toBe("youtube");
    expect(url.searchParams.get("utm_medium")).toBe("video");
    expect(url.searchParams.get("utm_campaign")).toBe("spring");
  });

  it("does not set embed params (this is a full-page redirect, not an iframe)", () => {
    const url = new URL(
      buildCalendlyBookingUrl("https://calendly.com/team/intro", {
        email: "jane@example.com",
      }),
    );
    expect(url.searchParams.has("embed_domain")).toBe(false);
    expect(url.searchParams.has("embed_type")).toBe(false);
  });

  it("trims blank prefill values instead of adding empty params", () => {
    const url = new URL(
      buildCalendlyBookingUrl("https://calendly.com/team/intro", {
        name: "   ",
        email: "",
      }),
    );
    expect(url.searchParams.has("name")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("preserves existing query params on the base link", () => {
    const url = new URL(
      buildCalendlyBookingUrl(
        "https://calendly.com/team/intro?hide_gdpr_banner=1",
        { email: "jane@example.com" },
      ),
    );
    expect(url.searchParams.get("hide_gdpr_banner")).toBe("1");
    expect(url.searchParams.get("email")).toBe("jane@example.com");
  });
});

describe("isCalendlyUrl", () => {
  it("accepts https calendly.com links", () => {
    expect(isCalendlyUrl("https://calendly.com/team/intro")).toBe(true);
    expect(isCalendlyUrl("https://acme.calendly.com/intro")).toBe(true);
  });

  it("rejects non-calendly hosts, http, and junk", () => {
    expect(isCalendlyUrl("https://evil.com/team")).toBe(false);
    expect(isCalendlyUrl("http://calendly.com/team")).toBe(false);
    expect(isCalendlyUrl("https://notcalendly.com/team")).toBe(false);
    expect(isCalendlyUrl("calendly.com/team")).toBe(false);
    expect(isCalendlyUrl("")).toBe(false);
  });
});
