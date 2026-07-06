import { describe, expect, it } from "vitest";
import { normalizeNewsSlug } from "./news-slug";

// I13: the review typed "Invalid Slug With Spaces!!" and it was accepted. The
// normalizer is the shared rule the client uses on every keystroke AND the
// server uses as the authoritative guard, so both must produce the same
// URL-safe result for the same input.
describe("normalizeNewsSlug", () => {
  it("strips spaces and punctuation into a URL-safe slug", () => {
    expect(normalizeNewsSlug("Invalid Slug With Spaces!!")).toBe(
      "invalid-slug-with-spaces",
    );
  });

  it("lowercases, drops quotes, and collapses separators to single hyphens", () => {
    expect(normalizeNewsSlug("The Founder's  BIG   News!")).toBe(
      "the-founders-big-news",
    );
  });

  it("trims leading and trailing hyphens produced by edge punctuation", () => {
    expect(normalizeNewsSlug("!!!Launch Day!!!")).toBe("launch-day");
  });

  it("returns an empty string when nothing URL-safe survives", () => {
    expect(normalizeNewsSlug("!!!")).toBe("");
    expect(normalizeNewsSlug("   ")).toBe("");
  });

  it("leaves an already-valid slug unchanged (no regression)", () => {
    expect(normalizeNewsSlug("campus-vending-2026")).toBe(
      "campus-vending-2026",
    );
  });
});
