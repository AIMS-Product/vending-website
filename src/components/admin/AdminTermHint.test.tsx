import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminTermHint } from "./AdminTermHint";

// I9: term hints must be keyboard-focusable and touch-usable — never rely on
// a `title` attribute or hover-only CSS, since neither reaches touch or
// screen-reader users reliably.
describe("AdminTermHint", () => {
  it("renders a real, keyboard-focusable button (not a span with title)", () => {
    const html = renderToStaticMarkup(
      <AdminTermHint
        term="301"
        explanation="Moved permanently. Browsers and Google remember the new address."
      />,
    );

    expect(html).toContain("<button");
    expect(html).not.toContain("title=");
  });

  it("shows the term and links the trigger to a collapsed disclosure via aria-expanded/aria-controls", () => {
    const html = renderToStaticMarkup(
      <AdminTermHint term="301" explanation="Moved permanently." />,
    );

    expect(html).toContain(">301<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/aria-controls="([^"]+)"/);
    // Collapsed by default: the explanation panel is not rendered until opened.
    expect(html).not.toContain("Moved permanently.");
  });

  it("aria-controls references an id, ready to match the panel once opened", () => {
    const html = renderToStaticMarkup(
      <AdminTermHint term="308" explanation="Permanent redirect." />,
    );

    const match = html.match(/aria-controls="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match?.[1]?.length).toBeGreaterThan(0);
  });
});
