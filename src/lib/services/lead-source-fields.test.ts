import { describe, expect, it } from "vitest";
import { z } from "zod";
import { leadSourceSchemaFields } from "./lead-source-fields";

const schema = z.object(leadSourceSchemaFields);

describe("leadSourceSchemaFields.sourcePageId", () => {
  // Regression: /resources/roadmap and /resources/finance-templates are coded
  // pages with a synthetic `coded:<slug>` id and no seo_pages row. Passing it
  // through to the uuid column failed every submit with 22P02, so both lead
  // magnets captured nothing between 2026-07-31 and 2026-08-26.
  it("drops a coded page's synthetic id instead of failing the submit", () => {
    const parsed = schema.parse({
      sourcePageId: "coded:roadmap",
      sourcePageSlug: "roadmap",
    });
    expect(parsed.sourcePageId).toBeNull();
    expect(parsed.sourcePageSlug).toBe("roadmap");
  });

  it("keeps a real page uuid", () => {
    const id = "2d3b9fbc-c270-4cd4-a970-97aeb95cd5ec";
    expect(schema.parse({ sourcePageId: id }).sourcePageId).toBe(id);
  });

  it("drops any other value the uuid column cannot hold", () => {
    for (const value of ["", "  ", "not-a-uuid", "123"]) {
      expect(schema.parse({ sourcePageId: value }).sourcePageId).toBeNull();
    }
  });
});
