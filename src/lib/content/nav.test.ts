import { describe, expect, it } from "vitest";
import { footerColumns, headerCta, primaryNav } from "./nav";

// Kody's 2026-08-10 copy pass. The header CTA and the Resources destination are
// the two nav strings he changed; both had been easy to regress because the CTA
// was hardcoded in Header.tsx.
describe("site navigation", () => {
  it("uses Kody's header CTA wording and sends it to the contact funnel", () => {
    expect(headerCta.label).toBe("Get Started");
    expect(headerCta.href).toBe("/contact");
  });

  it("points Resources at the news index in both the header and the footer", () => {
    const headerResources = primaryNav.find(
      (item) => item.label === "Resources",
    );
    expect(headerResources?.href).toBe("/news");

    const footerResources = footerColumns
      .flatMap((column) => column.items)
      .find((item) => item.label === "Resources");
    expect(footerResources?.href).toBe("/news");
  });

  it("no longer links /pre-call-resources from anywhere in the nav", () => {
    // Not a bug — a consequence of the change above, and the reason it was
    // flagged back to Kody. The page is still live and reachable by URL.
    const everyHref = [
      ...primaryNav,
      ...footerColumns.flatMap((column) => column.items),
    ].map((item) => item.href);
    expect(everyHref).not.toContain("/pre-call-resources");
  });
});
