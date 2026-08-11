import { describe, expect, it } from "vitest";
import { metadata } from "./page";

// /book-now is a duplicate of /contact with the scoring stage removed. It must
// never compete with /contact in search, or the two split the same rankings.
describe("/book-now metadata", () => {
  it("is noindex and canonicalises to /contact", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe("/contact");
  });
});
