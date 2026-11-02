import { describe, expect, it } from "vitest";
import { pickRelatedReading } from "./related-reading";

const COST = "/resources/how-much-does-a-vending-machine-cost";
const MONEY = "/news/how-much-money-do-vending-machines-make-2026";
const link = (href: string) => ({ href, title: href });

describe("pickRelatedReading", () => {
  it("links the income article to the cost guide first", () => {
    const picked = pickRelatedReading(MONEY, [
      link("/news/a"),
      link(MONEY),
      link("/news/b"),
      link(COST),
    ]);
    expect(picked.map((item) => item.href)).toEqual([
      COST,
      "/news/b",
      "/news/a",
    ]);
  });

  it("never links an article to itself or repeats a link", () => {
    const hrefs = pickRelatedReading("/news/unmapped", [
      link("/news/unmapped"),
      link("/news/a"),
      link("/news/b"),
    ]).map((item) => item.href);
    expect(hrefs).toEqual(["/news/a", "/news/b"]);
  });

  it("skips topic links that are no longer published", () => {
    const hrefs = pickRelatedReading(MONEY, [link(MONEY), link("/news/a")]).map(
      (item) => item.href,
    );
    expect(hrefs).toEqual(["/news/a"]);
  });
});
