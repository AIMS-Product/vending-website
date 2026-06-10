import { describe, expect, it, vi } from "vitest";
import { copyRailUrl } from "./editor-copy-url";
import { backToPagesHref } from "./SeoPageEditorTopRail";

describe("backToPagesHref", () => {
  it("carries the ?created param when a page was just created in-session", () => {
    // Brand-new page: no loaded `page`, but a draft row now exists in-session.
    const created = "11111111-1111-4111-8111-111111111111";
    expect(backToPagesHref(null, created)).toBe(
      `/admin/pages?created=${created}`,
    );
  });

  it("stays plain when editing an already-loaded (not just-created) page", () => {
    const loaded = "22222222-2222-4222-8222-222222222222";
    // A loaded page returns plain — returning to the list is not a "create".
    expect(backToPagesHref({ id: loaded }, loaded)).toBe("/admin/pages");
  });

  it("stays plain for a brand-new page with no draft row yet", () => {
    // Nothing typed yet, so no row exists to link to.
    expect(backToPagesHref(null, null)).toBe("/admin/pages");
  });
});

describe("copyRailUrl", () => {
  it("returns a success message after writing the requested URL", async () => {
    const writeText = vi.fn(async () => {});

    await expect(
      copyRailUrl(
        () => "http://localhost:3000/admin/pages/page_1",
        "Editor link copied.",
        writeText,
      ),
    ).resolves.toEqual({
      message: "Editor link copied.",
      tone: "success",
    });

    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/admin/pages/page_1",
    );
  });

  it("returns a manual-copy fallback when clipboard writing fails", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("Clipboard denied");
    });

    await expect(
      copyRailUrl(
        () => "http://localhost:3000/resources/vending-in-colleges",
        "Public URL copied.",
        writeText,
      ),
    ).resolves.toEqual({
      message: "Copy failed. Select the URL below to copy it manually.",
      tone: "error",
      manualUrl: "http://localhost:3000/resources/vending-in-colleges",
    });
  });

  it("does not call the clipboard writer when there is no URL", async () => {
    const writeText = vi.fn(async () => {});

    await expect(
      copyRailUrl(() => null, "Editor link copied.", writeText),
    ).resolves.toBeNull();

    expect(writeText).not.toHaveBeenCalled();
  });
});
