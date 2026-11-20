import { describe, expect, it } from "vitest";
import { addHeadingAnchors } from "./heading-anchors";

describe("addHeadingAnchors", () => {
  it("ids every h2, dedupes repeats and lists them for the contents", () => {
    const { html, headings } = addHeadingAnchors(
      "<h2>Costs &amp; Fees</h2><p>x</p><h3>Sub</h3><h2>FAQ</h2><h2>FAQ</h2><h2><strong>Next</strong> steps</h2>",
    );

    expect(headings).toEqual([
      { id: "costs-fees", text: "Costs & Fees" },
      { id: "faq", text: "FAQ" },
      { id: "faq-2", text: "FAQ" },
      { id: "next-steps", text: "Next steps" },
    ]);
    expect(html).toContain('<h2 id="costs-fees">Costs &amp; Fees</h2>');
    expect(html).toContain('<h2 id="faq-2">FAQ</h2>');
    expect(html).toContain("<h3>Sub</h3>");
  });

  it("leaves empty headings alone", () => {
    expect(addHeadingAnchors("<h2> </h2>")).toEqual({
      html: "<h2> </h2>",
      headings: [],
    });
  });
});
