import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The sidebar is `xl:sticky xl:top-0`. Any ancestor with overflow hidden,
 * auto or scroll becomes its scroll container, and since that box grows with
 * the page instead of scrolling, the nav scrolled away with the content.
 * Horizontal overflow is clipped with `overflow-x-clip`, which hides the
 * same overflow without creating a scroll container.
 */
describe("AdminShell sticky sidebar", () => {
  it("never wraps the sticky sidebar in a scroll container", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/admin/AdminShell.tsx"),
      "utf8",
    );
    expect(source).toContain("xl:sticky xl:top-0");
    // The page wrapper is the sidebar's ancestor; its class list is the
    // first className after `data-admin-ui`.
    const wrapper = source
      .slice(source.indexOf("data-admin-ui"))
      .match(/className="([^"]*)"/)?.[1];
    expect(wrapper).toContain("overflow-x-clip");
    expect(wrapper).not.toMatch(/overflow-(x-|y-)?(hidden|auto|scroll)/);
  });
});
