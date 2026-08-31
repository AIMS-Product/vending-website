import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  APP_TOP_LEVEL_PAGE_SEGMENTS,
  isUnknownSingleSegmentPublicPath,
} from "./single-segment-routes";

const APP_DIR = path.resolve(__dirname, "../../app");

function hasOwnRoute(dir: string): boolean {
  return ["page.tsx", "page.ts", "route.ts", "route.tsx"].some((file) =>
    fs.existsSync(path.join(dir, file)),
  );
}

// Top-level URL segments the filesystem actually serves: directories with a
// page/route file, with route groups `(group)` expanded one level and dynamic
// segments `[param]` skipped (the dynamic catch-alls are exactly what the
// proxy's 404 check guards).
function scanTopLevelSegments(): Set<string> {
  const segments = new Set<string>();
  for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith("[")) continue;
    if (name.startsWith("(")) {
      for (const child of fs.readdirSync(path.join(APP_DIR, name), {
        withFileTypes: true,
      })) {
        if (!child.isDirectory() || child.name.startsWith("[")) continue;
        if (hasOwnRoute(path.join(APP_DIR, name, child.name))) {
          segments.add(child.name);
        }
      }
      continue;
    }
    if (name === "api") continue; // excluded from the proxy matcher entirely
    if (hasOwnRoute(path.join(APP_DIR, name))) {
      segments.add(name);
    }
  }
  return segments;
}

describe("APP_TOP_LEVEL_PAGE_SEGMENTS", () => {
  it("matches the src/app filesystem exactly (drift guard)", () => {
    const fromDisk = scanTopLevelSegments();
    // A segment on disk but missing from the set would 404 a real page in
    // production; a segment in the set but not on disk keeps a dead URL
    // soft-404ing. Both directions must stay in sync.
    expect([...APP_TOP_LEVEL_PAGE_SEGMENTS].sort()).toEqual(
      [...fromDisk].sort(),
    );
  });
});

describe("isUnknownSingleSegmentPublicPath", () => {
  it("keeps filesystem routes reachable", () => {
    expect(isUnknownSingleSegmentPublicPath("/about")).toBe(false);
    expect(isUnknownSingleSegmentPublicPath("/news")).toBe(false);
    expect(isUnknownSingleSegmentPublicPath("/contact")).toBe(false);
  });

  it("keeps legacy lead routes reachable", () => {
    expect(isUnknownSingleSegmentPublicPath("/booking-meta")).toBe(false);
    expect(isUnknownSingleSegmentPublicPath("/vending-route-blueprint")).toBe(
      false,
    );
    expect(
      isUnknownSingleSegmentPublicPath("/book-my-advisory-call-setter"),
    ).toBe(false);
  });

  it("flags dead single-segment paths", () => {
    expect(isUnknownSingleSegmentPublicPath("/zzz-does-not-exist")).toBe(true);
    expect(isUnknownSingleSegmentPublicPath("/booking")).toBe(true);
    expect(isUnknownSingleSegmentPublicPath("/resources")).toBe(true);
  });

  it("ignores multi-segment paths and the root", () => {
    expect(isUnknownSingleSegmentPublicPath("/")).toBe(false);
    expect(isUnknownSingleSegmentPublicPath("/news/anything")).toBe(false);
    expect(isUnknownSingleSegmentPublicPath("/solutions/coaching")).toBe(false);
  });

  it("treats malformed or slash-encoding segments as unknown", () => {
    expect(isUnknownSingleSegmentPublicPath("/%zz")).toBe(true);
    expect(isUnknownSingleSegmentPublicPath("/about%2Ffoo")).toBe(true);
  });

  it("resolves percent-encoded known segments", () => {
    expect(isUnknownSingleSegmentPublicPath("/%61bout")).toBe(false);
  });
});
