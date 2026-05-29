import { describe, expect, it } from "vitest";
import { parseStructuredDataSettings } from "./structured-data-settings";

describe("parseStructuredDataSettings", () => {
  it("defaults existing empty settings to enabled structured data", () => {
    expect(parseStructuredDataSettings({})).toEqual({
      breadcrumb: true,
      faq: true,
    });
  });

  it("keeps explicit disabled settings", () => {
    expect(
      parseStructuredDataSettings({ breadcrumb: false, faq: false }),
    ).toEqual({
      breadcrumb: false,
      faq: false,
    });
  });

  it("recovers from invalid stored values", () => {
    expect(parseStructuredDataSettings({ breadcrumb: "yes" })).toEqual({
      breadcrumb: true,
      faq: true,
    });
  });
});
