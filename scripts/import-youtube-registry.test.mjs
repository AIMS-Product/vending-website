import { describe, expect, it } from "vitest";
import { expandAliases, splitByBitlyLink } from "./import-youtube-registry.mjs";

const linkedRow = {
  utm_campaign: "pro-con",
  title: "Pros and cons",
  bitly_url: "https://booking.vendingpreneurs.com/yt-pro-con",
  bitly_id: "booking.vendingpreneurs.com/yt-pro-con",
  in_description: true,
};

const unlinkedRow = {
  utm_campaign: "no-link-yet",
  title: "No link yet",
  bitly_url: null,
  bitly_id: null,
  in_description: false,
};

/**
 * M13: 42 registry rows carry an explicit `bitly_id: null`. map-missing-links
 * fills those in by discovery; a re-import that sent the null back reset them,
 * and claimBatch never claims a null-id row again, so those links silently
 * stopped syncing.
 */
describe("splitByBitlyLink", () => {
  it("never sends a null bitly_id or bitly_url to the database", () => {
    const { unlinked } = splitByBitlyLink([unlinkedRow]);

    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]).not.toHaveProperty("bitly_id");
    expect(unlinked[0]).not.toHaveProperty("bitly_url");
    expect(unlinked[0].utm_campaign).toBe("no-link-yet");
    expect(unlinked[0].title).toBe("No link yet");
  });

  it("still seeds the link the registry does know about", () => {
    const { linked } = splitByBitlyLink([linkedRow]);

    expect(linked).toEqual([linkedRow]);
  });

  it("leaves the caller's rows untouched", () => {
    const rows = [{ ...unlinkedRow }];
    splitByBitlyLink(rows);

    expect(rows[0]).toHaveProperty("bitly_id", null);
  });

  it("keeps every payload homogeneous, which PostgREST requires", () => {
    const { linked, unlinked } = splitByBitlyLink([
      linkedRow,
      unlinkedRow,
      { ...linkedRow, utm_campaign: "second" },
    ]);

    for (const group of [linked, unlinked]) {
      const shapes = new Set(
        group.map((row) => Object.keys(row).sort().join()),
      );
      expect(shapes.size).toBeLessThanOrEqual(1);
    }
    expect(linked).toHaveLength(2);
    expect(unlinked).toHaveLength(1);
  });

  it("treats an empty-string id as no link", () => {
    const { unlinked } = splitByBitlyLink([{ ...unlinkedRow, bitly_id: "" }]);

    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]).not.toHaveProperty("bitly_id");
  });
});

describe("expandAliases still works alongside the split", () => {
  it("carries the alias row through the linked group", () => {
    const rows = expandAliases([
      { ...linkedRow, utm_campaign: "vending-machine-location-strategy" },
    ]);
    const { linked } = splitByBitlyLink(rows);

    expect(linked.map((row) => row.utm_campaign)).toContain(
      "vending-machine-location",
    );
  });
});
