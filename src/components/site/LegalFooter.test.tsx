import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { footerColumns } from "@/lib/content/nav";
import { LegalFooter } from "./LegalFooter";

// The legacy lead pages drop the full site footer. Terms and Privacy must stay
// reachable, worded exactly as the site footer words them, and nothing else
// (no disclaimer copy, no nav exits) may appear.
describe("LegalFooter", () => {
  const html = renderToStaticMarkup(<LegalFooter />);
  const siteItems = footerColumns.flatMap((column) => column.items);

  it.each(["/terms", "/privacy", "/spam-policy"])(
    "links %s with the site footer's own label",
    (href) => {
      const item = siteItems.find((entry) => entry.href === href);
      expect(item).toBeDefined();
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(`>${item?.label}<`);
    },
  );

  it("carries no navigation exits and no disclaimer copy", () => {
    expect(html).not.toContain('href="/contact"');
    expect(html).not.toContain('href="/about"');
    expect(html).not.toMatch(/claim|guarantee|applying/i);
  });
});
