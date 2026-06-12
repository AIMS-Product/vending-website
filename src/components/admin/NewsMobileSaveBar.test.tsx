import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsMobileSaveBar } from "./NewsMobileSaveBar";

/**
 * S19 (finding C145): below the `lg` breakpoint the news editor's Publish aside
 * stacks ~1500px below the body field, so "Save draft" is never on screen while
 * a user types. This viewport-fixed bar keeps Save reachable on narrow screens
 * and must submit the SAME form via a `type="submit"` intent=save button, so it
 * reuses the editor's existing save path rather than forking it.
 *
 * Hidden at `lg` and up (`lg:hidden`) so the desktop layout is untouched.
 */
const html = renderToStaticMarkup(
  <NewsMobileSaveBar formId="news-editor-form" />,
);

describe("NewsMobileSaveBar", () => {
  it("is hidden at the lg breakpoint and up", () => {
    expect(html).toMatch(/class="[^"]*\blg:hidden\b[^"]*"/);
  });

  it("renders a Save submit button wired to the editor form", () => {
    expect(html).toMatch(/<button\b[^>]*type="submit"[^>]*>/);
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="save"');
    expect(html).toContain('form="news-editor-form"');
    expect(html).toContain("Save draft");
  });
});
