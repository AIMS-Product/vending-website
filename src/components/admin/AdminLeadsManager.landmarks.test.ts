import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * I2 (P1): AdminLeadDetailView rendered a nested <main className="grid gap-5">
 * inside the AdminShell's own `main#main-content` landmark, tripping axe's
 * `landmark-no-duplicate-main`. The lead detail rail also rendered as an
 * <aside>, nesting a complementary landmark inside AdminShell's <section>
 * region and tripping `landmark-complementary-is-top-level` — the same class
 * of bug NewsEditorForm hit (see NewsEditorForm.landmarks.test.ts). Both the
 * primary column and the rail are editor/detail chrome, not new page or
 * complementary landmarks, so both must render as plain <div>s.
 *
 * Asserted against source (the suite runs in a node environment); the
 * Playwright axe run in the browser gate proves zero `landmark-no-duplicate-main`
 * and `landmark-complementary` violations on /admin/leads/[id].
 */
const source = readFileSync(
  path.resolve(__dirname, "./AdminLeadsManager.tsx"),
  "utf8",
);

describe("AdminLeadsManager landmark nesting", () => {
  it("does not render a nested <main> landmark in the lead detail view", () => {
    expect(source).not.toMatch(/<main[\s>]/);
  });

  it("does not render the lead detail rail as an <aside> landmark", () => {
    expect(source).not.toMatch(/<aside[\s>]/);
  });
});
