import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  path.resolve(__dirname, "./layout.tsx"),
  "utf8",
);

describe("root layout social defaults", () => {
  it("ships a default share image that exists in public/", () => {
    expect(layoutSource).toContain('url: "/og/default.png"');
    expect(
      existsSync(path.resolve(__dirname, "../../public/og/default.png")),
    ).toBe(true);
  });

  it("does not pin og:url to the homepage for every inheriting page", () => {
    const og = layoutSource.slice(layoutSource.indexOf("openGraph: {"));
    expect(og.slice(0, og.indexOf("twitter:"))).not.toMatch(/\burl: "\/"/);
  });
});
