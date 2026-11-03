import { describe, expect, it } from "vitest";
import { isOrganicSearchLead } from "./organic-lead";

const lead = (referrer: string | null, utm_source: string | null = null) => ({
  referrer,
  utm_source,
});

describe("isOrganicSearchLead", () => {
  it("counts untagged leads from a search engine", () => {
    expect(isOrganicSearchLead(lead("https://www.google.com/"))).toBe(true);
    expect(isOrganicSearchLead(lead("https://www.bing.com/search?q=x"))).toBe(
      true,
    );
    expect(isOrganicSearchLead(lead("https://search.yahoo.com/"))).toBe(true);
  });

  it("leaves out paid traffic, which carries tags", () => {
    expect(isOrganicSearchLead(lead("https://www.google.com/", "google"))).toBe(
      false,
    );
  });

  it("leaves out everything else", () => {
    expect(isOrganicSearchLead(lead(null))).toBe(false);
    expect(isOrganicSearchLead(lead("https://mail.google.com/"))).toBe(false);
    expect(isOrganicSearchLead(lead("https://www.facebook.com/"))).toBe(false);
    expect(isOrganicSearchLead(lead("https://google.com.evil.example/"))).toBe(
      false,
    );
  });
});
