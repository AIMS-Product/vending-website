import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";

describe("renderMarkdown", () => {
  it("leaves stored body content on the plain pipeline by default", async () => {
    // Every news post and SEO page renders through this call. Turning GFM on
    // for all of them would silently change published content, so the default
    // must stay non-GFM.
    const html = await renderMarkdown(TABLE);
    expect(html).not.toContain("<table>");
  });

  it("renders tables when a caller opts in", async () => {
    const html = await renderMarkdown(TABLE, { gfm: true });
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("still sanitises on the GFM pipeline", async () => {
    const html = await renderMarkdown("# Hi\n\n<script>alert(1)</script>\n", {
      gfm: true,
    });
    expect(html).not.toContain("<script");
  });
});
