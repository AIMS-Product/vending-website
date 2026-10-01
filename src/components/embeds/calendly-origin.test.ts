import { describe, expect, it } from "vitest";
import { isCalendlyOrigin } from "./calendly-origin";

describe("isCalendlyOrigin", () => {
  it.each([
    "https://calendly.com",
    "https://assets.calendly.com",
    "https://a.b.calendly.com",
  ])("accepts %s", (origin) => {
    expect(isCalendlyOrigin(origin)).toBe(true);
  });

  it.each([
    "https://evilcalendly.com",
    "https://calendly.com.evil.io",
    "http://calendly.com",
    "https://calendly.com:8443",
    "https://calendly.com/",
    "",
  ])("rejects %s", (origin) => {
    expect(isCalendlyOrigin(origin)).toBe(false);
  });
});
