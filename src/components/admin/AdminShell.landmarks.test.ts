import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * N1 (admin-ux-wave-3): AdminShell's desktop sidebar rendered as an aside
 * element. The root layout (src/app/layout.tsx) owns the main#main-content
 * landmark that wraps every page, so the sidebar became a complementary
 * landmark nested inside main, tripping axe's
 * `landmark-complementary-is-top-level` on every /admin route. The sidebar is
 * shell chrome, not page-complementary content, so it must not be a landmark
 * — a plain div keeps the visuals while the inner nav labelled "Admin
 * sections" remains the discoverable landmark. Same fix class as
 * AdminLeadsManager.landmarks.test.ts (I2) and
 * NewsEditorForm.landmarks.test.ts (S5).
 *
 * Asserted against source (the suite runs in a node environment); a browser
 * axe run in the feature gate proves zero `landmark-complementary` violations
 * on /admin routes. Comments in AdminShell.tsx must describe tags in words
 * (no literal angle-bracket tag text) or these source scans false-fail.
 */
const source = readFileSync(
  path.resolve(__dirname, "./AdminShell.tsx"),
  "utf8",
);

describe("AdminShell landmark nesting", () => {
  it("does not render the desktop sidebar as an aside landmark", () => {
    expect(source).not.toMatch(/<aside[\s>]/);
  });

  it("does not render a nested main landmark", () => {
    expect(source).not.toMatch(/<main[\s>]/);
  });

  it("keeps the sidebar's Admin sections nav as the discoverable landmark", () => {
    expect(source).toContain('ariaLabel="Admin sections"');
    expect(source).toMatch(/<nav\b[^>]*aria-label=\{ariaLabel\}/);
  });
});
