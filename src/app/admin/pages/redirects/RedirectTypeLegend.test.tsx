import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RedirectTypeLegend } from "./RedirectTypeLegend";

// I9: plain-language redirect-type legend shared by the create form and the
// per-row edit form. Technical labels stay visible; the plain explanation is
// only revealed through AdminTermHint, so it must not appear in the initial
// static markup.
describe("RedirectTypeLegend", () => {
  it("lists every technical redirect-type label with a term hint trigger", () => {
    const html = renderToStaticMarkup(<RedirectTypeLegend />);

    expect(html).toContain("Permanent move (301)");
    expect(html).toContain("Temporary move (302)");
    expect(html).toContain("Temporary redirect (307)");
    expect(html).toContain("Permanent redirect (308)");
    // Four options -> four hint buttons.
    expect(html.match(/<button/g)?.length).toBe(4);
  });

  it("shows the heading by default and can hide it for tighter layouts", () => {
    const withHeading = renderToStaticMarkup(<RedirectTypeLegend />);
    const withoutHeading = renderToStaticMarkup(
      <RedirectTypeLegend heading={false} />,
    );

    expect(withHeading).toContain("What does each redirect type mean?");
    expect(withoutHeading).not.toContain("What does each redirect type mean?");
  });
});
