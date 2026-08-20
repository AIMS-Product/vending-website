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
  /**
   * Two shapes satisfy the ≥44px rule, so the assertion checks the guarantee
   * rather than one spelling of it: text links grow an invisible hit area with
   * vertical padding, while the social icon buttons are a fixed 44px square
   * (h-11 w-11) because there is no text to pad around.
   */
  const hasPaddedBlock = (tag: string) =>
    /\bblock\b/.test(tag) && /\bpy-3\b/.test(tag);
  const hasFixedTapBox = (tag: string) =>
    /\bh-11\b/.test(tag) && /\bw-11\b/.test(tag);

  it("gives every footer link a ≥44px mobile hit area", () => {
    const footerAnchors = anchorOpenTags(footerHtml);
    expect(footerAnchors.length).toBeGreaterThan(0);
    expect(
      footerAnchors.every((tag) => hasPaddedBlock(tag) || hasFixedTapBox(tag)),
    ).toBe(true);
  });

  it("links every brand social account with an accessible name", () => {
    // Handles were verified live on 2026-08-20; x.com and facebook.com are
    // deliberately absent because neither account resolves.
    for (const href of [
      "https://www.youtube.com/@Vendingpreneurs",
      "https://www.instagram.com/vendingpreneurs/",
      "https://www.tiktok.com/@vendingpreneurs",
      "https://www.linkedin.com/company/vendingpreneurs",
    ]) {
      expect(footerHtml).toContain(href);
    }

    // The mark is aria-hidden, so the sr-only label is the only accessible
    // name each icon link has — without it they announce as bare URLs.
    for (const label of ["YouTube", "Instagram", "TikTok", "LinkedIn"]) {
      expect(footerHtml).toContain(`${label} — opens in a new tab`);
    }

    const socialAnchors = anchorOpenTags(footerHtml).filter(hasFixedTapBox);
    expect(socialAnchors).toHaveLength(4);
    expect(
      socialAnchors.every((tag) =>
        tag.includes('rel="noopener noreferrer me"'),
      ),
    ).toBe(true);
  });
});
