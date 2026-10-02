import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyrightLine } from "./CopyrightLine";

describe("CopyrightLine", () => {
  it("prints the current year and the brand", () => {
    const html = renderToStaticMarkup(createElement(CopyrightLine));
    expect(html).toContain(String(new Date().getFullYear()));
    expect(html).toContain("Vendingpreneurs. All rights reserved.");
  });
});
