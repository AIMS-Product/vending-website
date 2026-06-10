import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Header/Footer are client components that read the current route; the route is
// external to the tap-target sizing under test, so usePathname is mocked to a
// public path (admin paths early-return null).
vi.mock("next/navigation", () => ({
  usePathname: () => "/about",
}));

import { Header } from "./Header";
import { Footer } from "./Footer";

const headerHtml = renderToStaticMarkup(<Header />);
const footerHtml = renderToStaticMarkup(<Footer />);

/**
 * S2 (findings C093/C110/C094/C129/C047): public header nav links rendered
 * ~20px tall and footer links ~17px tall — below the WCAG 2.2 AA 24px minimum
 * and the 44px comfortable mobile target. The fix enlarges the invisible hit
 * area via vertical padding (with negative-margin compensation so the visual
 * rhythm is unchanged), never the text size, weight, or color. The Playwright
 * boundingBox run in the browser gate proves the measured heights.
 *
 * These assertions lock the padding utilities onto the rendered anchors so a
 * future refactor cannot silently shrink the hit area back below threshold.
 */

/** Anchor tag substrings, e.g. ['<a href="/about" ...>', ...]. */
function anchorOpenTags(source: string): string[] {
  return [...source.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0]);
}

describe("Header tap targets", () => {
  it("gives every nav link vertical padding for an enlarged hit area", () => {
    // HeaderNavLink anchors carry rounded-[6px] (the CTA buttons use
    // rounded-[8px]); both the desktop inline and mobile menu variants must
    // include py-3 for the enlarged hit area.
    const navAnchors = anchorOpenTags(headerHtml).filter((tag) =>
      tag.includes("rounded-[6px]"),
    );
    expect(navAnchors.length).toBeGreaterThan(0);
    expect(navAnchors.every((tag) => /\bpy-3\b/.test(tag))).toBe(true);
  });
});

describe("Footer tap targets", () => {
  it("makes every footer link a padded block for a ≥44px mobile hit area", () => {
    const footerAnchors = anchorOpenTags(footerHtml);
    expect(footerAnchors.length).toBeGreaterThan(0);
    expect(
      footerAnchors.every(
        (tag) => /\bblock\b/.test(tag) && /\bpy-3\b/.test(tag),
      ),
    ).toBe(true);
  });
});
