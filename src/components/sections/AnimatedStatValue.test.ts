import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AnimatedStatValue } from "@/components/sections/AnimatedStatValue";

/**
 * N3: hero stats must server-render their real values. The server-rendered
 * (no-JS) HTML must contain the real formatted value — never a zeroed variant
 * like "0+" or "$0M+" — so crawlers, no-JS users, and first paint see the
 * truth. The count-up animation is progressive enhancement layered on after
 * hydration.
 */
describe("AnimatedStatValue SSR", () => {
  it.each([
    ["500+", "500+"],
    ["$3M+", "$3M+"],
    ["3,000+", "3,000+"],
  ])("renders the real value for %s on the server", (input, expected) => {
    const html = renderToString(
      createElement(AnimatedStatValue, { value: input }),
    );

    expect(html).toContain(expected);
  });

  it("never server-renders a zeroed variant", () => {
    const html = renderToString(
      createElement(AnimatedStatValue, { value: "$3M+" }),
    );

    expect(html).not.toContain("$0M+");
    expect(html).not.toContain(">0<");
  });
});
