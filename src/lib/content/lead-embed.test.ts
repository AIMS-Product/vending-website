import { describe, expect, it } from "vitest";
import {
  buildCalendlyBookingUrl,
  buildCalendlySrc,
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

describe("buildCalendlySrc fallback tags", () => {
  const fallbackUtms = {
    utm_source: "instagram",
    utm_medium: "organic",
    utm_campaign: "booking-ig",
  };

  it("tags an untagged visit with the page's own channel", () => {
    const url = new URL(
      buildCalendlySrc(
        "https://calendly.com/team/intro",
        {} as LeadAttribution,
        {
          fallbackUtms,
        },
      ),
    );
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("utm_campaign")).toBe("booking-ig");
  });

  it("never overrides the tags a visitor arrived with", () => {
    const url = new URL(
      buildCalendlySrc("https://calendly.com/team/intro", attribution, {
        fallbackUtms,
      }),
    );
    expect(url.searchParams.get("utm_source")).toBe("youtube");
    expect(url.searchParams.get("utm_medium")).toBe("video");
    expect(url.searchParams.get("utm_campaign")).toBe("spring");
  });
});
