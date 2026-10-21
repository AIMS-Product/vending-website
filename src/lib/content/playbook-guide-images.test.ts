import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guideImages } from "./playbook-guide-images";

// Regression guard for the 2026-10-20 leak: the hero viewer served readable
// renders of paid PDF pages. Only the cover (1) and contents (2) may be
// readable; every other page is published blurred (baked into the file).
const pub = join(process.cwd(), "public");
const dir = join(pub, "images/playbook-guide");
const all = [guideImages.cover, ...guideImages.previews, ...guideImages.viewer];
const pageNo = (src: string) => Number(/page-(\d+)/.exec(src)?.[1]);

describe("playbook guide page images", () => {
  it.each(all.map((i) => [i.src, i]))("%s exists in public/", (src) => {
    expect(existsSync(join(pub, src))).toBe(true);
  });

  it.each(all.map((i) => [i.src, i]))(
    "%s is locked unless page 1 or 2",
    (src, img) => {
      const readable = [1, 2].includes(pageNo(src));
      expect(img.locked).toBe(!readable);
      if (!readable) expect(src).toMatch(/-locked\.webp$/);
    },
  );

  it("public folder holds only page-1, page-2 and *-locked.webp files", () => {
    const allowed = /^(page-[12]\.webp|page-\d+-locked\.webp)$/;
    expect(readdirSync(dir).filter((f) => !allowed.test(f))).toEqual([]);
  });

  // A readable render saved under a locked name would pass the name check.
  // Blurred files are 4-10 KB; readable renders are ~55 KB.
  it("every *-locked.webp is small enough to be blurred", () => {
    const big = readdirSync(dir).filter(
      (f) => f.endsWith("-locked.webp") && statSync(join(dir, f)).size > 20_000,
    );
    expect(big).toEqual([]);
  });

  it("no page render sits anywhere else in public/", () => {
    const stray = readdirSync(pub, {
      recursive: true,
      encoding: "utf8",
    }).filter(
      (f) =>
        /(^|\/)page-\d+[^/]*$/.test(f) &&
        !f.startsWith("images/playbook-guide/"),
    );
    expect(stray).toEqual([]);
  });
});
