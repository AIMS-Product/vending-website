import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  lookupRedirectForPath,
  resetRedirectTableCache,
} from "./redirect-table";

const mocks = vi.hoisted(() => ({ listBuilderRedirects: vi.fn() }));

vi.mock("@/lib/services/seo-page-public", () => ({
  listBuilderRedirects: mocks.listBuilderRedirects,
}));

const row = {
  source_path: "/old-webflow-page",
  destination_path: "/contact",
  status_code: 301,
};

describe("lookupRedirectForPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedirectTableCache();
    mocks.listBuilderRedirects.mockResolvedValue([row]);
  });

  it("returns the redirect configured for the path", async () => {
    expect(await lookupRedirectForPath("/old-webflow-page")).toEqual(row);
  });

  it("returns null for a path with no redirect", async () => {
    expect(await lookupRedirectForPath("/contact")).toBeNull();
  });

  it("serves repeat lookups from cache instead of re-querying", async () => {
    const start = 1_000_000;
    await lookupRedirectForPath("/old-webflow-page", start);
    await lookupRedirectForPath("/contact", start + 30_000);

    expect(mocks.listBuilderRedirects).toHaveBeenCalledOnce();
  });

  it("reloads once the cached table goes stale, picking up new rows", async () => {
    const start = 1_000_000;
    await lookupRedirectForPath("/whatever", start);

    const added = {
      source_path: "/brand-new",
      destination_path: "/booking-meta",
      status_code: 302,
    };
    mocks.listBuilderRedirects.mockResolvedValue([row, added]);

    expect(await lookupRedirectForPath("/brand-new", start + 61_000)).toEqual(
      added,
    );
    expect(mocks.listBuilderRedirects).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the page when the redirect table cannot be read", async () => {
    mocks.listBuilderRedirects.mockRejectedValue(new Error("supabase down"));

    expect(await lookupRedirectForPath("/old-webflow-page")).toBeNull();
  });
});
