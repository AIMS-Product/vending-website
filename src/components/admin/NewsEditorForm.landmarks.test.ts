import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S5 (finding C057): the news editor's Publish/Cover sidebar rendered as an
 * <aside>, nesting a complementary landmark inside AdminShell's <section>
 * region landmark and tripping axe's `landmark-complementary-is-top-level`.
 * The sidebar is editor chrome, not page-complementary content, so it must not
 * be a landmark — a plain <div> keeps the visuals without the landmark role.
 *
 * Asserted against source (the suite runs in a node environment); the Playwright
 * axe run in the browser gate proves zero `landmark-complementary` violations on
 * /admin/news/new.
 */
const source = readFileSync(
  path.resolve(__dirname, "./NewsEditorForm.tsx"),
  "utf8",
);

describe("NewsEditorForm landmark nesting", () => {
  it("does not render the sidebar as an <aside> landmark", () => {
    expect(source).not.toMatch(/<aside\b/);
  });

  it("still mounts the mobile save bar for narrow viewports", () => {
    expect(source).toContain("NewsMobileSaveBar");
  });
});
