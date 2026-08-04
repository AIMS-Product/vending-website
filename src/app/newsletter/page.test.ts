import { describe, expect, it } from "vitest";
import {
  NEWSLETTER_META_DESCRIPTION,
  NEWSLETTER_PAGE_TITLE,
} from "@/lib/content/newsletter";
import { metadata } from "./page";

describe("newsletter route metadata", () => {
  it("uses an absolute title so the root layout cannot append a suffix", () => {
    expect(metadata.title).toEqual({ absolute: NEWSLETTER_PAGE_TITLE });
    expect(metadata.description).toBe(NEWSLETTER_META_DESCRIPTION);
    expect(metadata.alternates).toEqual({ canonical: "/newsletter" });
  });
});
