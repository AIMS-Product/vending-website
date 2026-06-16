import { describe, expect, it } from "vitest";
import { formatHtmlFragment } from "@/lib/page-builder/readable-source";

describe("formatHtmlFragment", () => {
  it("splits compressed markup into readable lines", () => {
    expect(formatHtmlFragment("<div><section><p>Hello</p></section></div>"))
      .toMatchInlineSnapshot(`
        "<div>
          <section>
            <p>Hello</p>
          </section>
        </div>"
      `);
  });

  it("does not indent after void elements", () => {
    expect(formatHtmlFragment('<div><img src="/a.jpg"/><p>Caption</p></div>'))
      .toMatchInlineSnapshot(`
        "<div>
          <img src="/a.jpg"/>
          <p>Caption</p>
        </div>"
      `);
  });
});
