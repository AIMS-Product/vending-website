import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CohortBanner } from "./CohortBanner";

describe("CohortBanner server render", () => {
  const html = renderToStaticMarkup(createElement(CohortBanner));

  it("gives the link an accessible name before the count is computed", () => {
    expect(html).toContain("Book your call");
    expect(html).toContain("sr-only");
  });

  it("does not bake a seat count into server HTML", () => {
    expect(html).not.toMatch(/open seat/);
  });
});
