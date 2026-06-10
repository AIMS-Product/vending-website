import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Accessibility contract for the public root layout. A skip-to-content link
 * must be the first actionable element and must target the main landmark, so
 * keyboard and screen-reader users can bypass the header on every page.
 *
 * Asserted against source (the suite runs in a node environment with no DOM
 * renderer); the Playwright tab-walk in the N12 browser gate proves the
 * rendered behavior.
 */
const layoutSource = readFileSync(
  path.resolve(__dirname, "./layout.tsx"),
  "utf8",
);

describe("root layout accessibility landmarks", () => {
  it("renders a skip-to-content link targeting the main landmark", () => {
    expect(layoutSource).toContain('href="#main-content"');
    expect(layoutSource).toContain("skip-to-content");
  });

  it("gives the main landmark the id the skip link points to", () => {
    expect(layoutSource).toMatch(/<main\b[^>]*id="main-content"/);
  });

  it("orders the skip link before the header so it is the first tab stop", () => {
    const skipIndex = layoutSource.indexOf('href="#main-content"');
    const headerIndex = layoutSource.indexOf("<Header");
    expect(skipIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeGreaterThan(-1);
    expect(skipIndex).toBeLessThan(headerIndex);
  });
});
