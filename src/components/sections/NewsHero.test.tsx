import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsHero } from "./NewsHero";

describe("NewsHero", () => {
  it("renders the hero heading as Vending News", () => {
    const html = renderToStaticMarkup(<NewsHero />);

    expect(html).toContain(">Vending News</h1>");
  });

  it("does not render Blog as the public hero heading", () => {
    const html = renderToStaticMarkup(<NewsHero />);

    expect(html).not.toContain(">Blog</h1>");
  });
});
