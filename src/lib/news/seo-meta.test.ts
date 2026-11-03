import { describe, expect, it } from "vitest";
import { newsSeoMetaEntries } from "./seo-meta";

describe("news SEO metadata", () => {
  it.each(newsSeoMetaEntries)("%s fits search results", (_slug, meta) => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.length).toBeLessThanOrEqual(160);
  });
});
