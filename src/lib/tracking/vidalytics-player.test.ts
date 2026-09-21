import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  getVidalyticsPlayer,
  vidalyticsContainerId,
} from "./vidalytics-player";

type Slot = { player?: unknown };

beforeEach(() => {
  (globalThis as { window?: unknown }).window = {} as Window;
});

/**
 * The bug this file exists for.
 *
 * Shipped keyed on the bare embed id, because Vidalytics' docs name the
 * argument EMBED_ID. On the live page the players register under the CONTAINER
 * id, so every promise stayed pending, no listener ever attached, and not one
 * event was recorded — with nothing failing, nothing logging, and a green
 * build. The only thing that can catch it is asserting the two ids agree.
 */
describe("the key the player registers under", () => {
  it("is the id VidalyticsPlayer hands to Vidalytics' loader", () => {
    const source = readFileSync(
      new URL("../../components/media/VidalyticsPlayer.tsx", import.meta.url),
      "utf8",
    );

    // The renderer must derive its container id from the shared helper, not
    // from its own template literal that can drift.
    expect(source).toContain("vidalyticsContainerId(embedId)");
    // ...and it is `containerId` that goes to their loader as the run target.
    expect(source).toMatch(/\$\{containerId\}/);
  });

  it("is what the listener waits on", () => {
    const source = readFileSync(
      new URL("../../components/media/VideoEngagement.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "getVidalyticsPlayer(vidalyticsContainerId(embedId))",
    );
  });

  it("prefixes the embed id", () => {
    expect(vidalyticsContainerId("abc123")).toBe("vidalytics_embed_abc123");
  });
});

describe("getVidalyticsPlayer", () => {
  it("resolves when the player assigns itself later", async () => {
    const id = vidalyticsContainerId("abc123");
    const pending = getVidalyticsPlayer(id);

    const slot = (
      globalThis.window as unknown as {
        _vidalytics: { embeds: Record<string, Slot> };
      }
    )._vidalytics.embeds[id];

    const player = {
      on() {},
      off() {},
      currentTime: () => 0,
      duration: () => 1,
    };
    slot.player = player;

    await expect(pending).resolves.toBe(player);
  });

  it("resolves immediately when the player is already there", async () => {
    const id = vidalyticsContainerId("abc123");
    const player = {
      on() {},
      off() {},
      currentTime: () => 0,
      duration: () => 1,
    };
    (globalThis.window as unknown as Record<string, unknown>)._vidalytics = {
      embeds: { [id]: { player } },
    };

    await expect(getVidalyticsPlayer(id)).resolves.toBe(player);
  });
});
