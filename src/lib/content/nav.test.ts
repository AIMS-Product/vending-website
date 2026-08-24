import { describe, expect, it } from "vitest";
import { footerColumns, headerCta, primaryNav } from "./nav";

// Kody's 2026-08-10 copy pass. The header CTA and the Resources destination are
// the two nav strings he changed; both had been easy to regress because the CTA
// was hardcoded in Header.tsx.
describe("site navigation", () => {
  it("uses Kody's header CTA wording and sends it to the contact funnel", () => {
    expect(headerCta.label).toBe("Get in Touch");
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

  it("keeps a way back to the pre-call resources page from the footer", () => {
    // Kody, 2026-08-11. Pointing header Resources at /news orphaned this page;
    // the footer slot is how it stays reachable until he builds it out.
    const footerItems = footerColumns.flatMap((column) => column.items);
    const prepare = footerItems.find(
      (item) => item.href === "/pre-call-resources",
    );
    expect(prepare?.label).toBe("Prepare for Your Call");
  });
});
