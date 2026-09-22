/**
 * A typed handle on an embedded Vidalytics player.
 *
 * Vidalytics ships two separate things: the per-video embed snippet (see
 * VidalyticsPlayer), which renders and plays, and a Player API that lets the
 * host page listen to that player. The API is opt-in — the embed snippet alone
 * does not expose it — and opting in means defining `getVidalyticsPlayer`
 * before the player finishes loading.
 *
 * Their published snippet does that by installing a setter on
 * `window._vidalytics.embeds[embedId].player`, so the promise resolves at the
 * moment the player assigns itself, whether that is before or after the call.
 * It is reproduced here as readable TypeScript rather than pasted as a minified
 * IIFE inside a <Script>, because a module import cannot arrive too late the
 * way a script tag can, and because nobody should have to un-minify this to
 * change it. The behaviour is theirs; only the spelling is ours.
 *
 * No API key, token or account access is involved — the embed id in the page
 * source is the whole handshake.
 *
 * THE KEY IS THE CONTAINER ID, NOT THE EMBED ID. Vidalytics' docs call the
 * argument EMBED_ID because their stock snippet names the container after the
 * video. Ours does not: VidalyticsPlayer renders `vidalytics_embed_<embedId>`
 * and passes that to their loader, so that is the name the player registers
 * itself under. Asking for the bare embed id creates a second, empty slot whose
 * setter never fires — a promise that stays pending forever and a listener that
 * never attaches, with nothing anywhere reporting a problem. Verified against
 * the live page 2026-09-21: `_vidalytics.embeds` held 30 keys, 15 real players
 * on the container ids and 15 dead slots on the embed ids.
 *
 * Docs: https://player-docs.vidalytics.com/api/getting-started
 */

/**
 * The DOM id VidalyticsPlayer gives a player's container, which is also the key
 * that player registers itself under. One function so the renderer and the
 * listener cannot drift apart again.
 */
export function vidalyticsContainerId(embedId: string): string {
  return `vidalytics_embed_${embedId}`;
}

/**
 * The subset of the player we use. `currentTime()` and `duration()` return
 * numbers synchronously, which is what progress is read from — the object
 * passed to a `timeupdate` callback is not documented, so we never read it.
 *
 * Docs: https://player-docs.vidalytics.com/api/methods
 */
export type VidalyticsPlayer = {
  on(eventName: string, callback: () => void): void;
  off(eventName: string, callback: () => void): void;
  currentTime(): number;
  duration(): number;
  muted(): boolean;
};

type VidalyticsEmbedSlot = { player?: VidalyticsPlayer };
type VidalyticsWindow = Window & {
  _vidalytics?: { embeds?: Record<string, VidalyticsEmbedSlot> };
};

/**
 * Resolves with the player for `containerId` once it exists.
 *
 * Pass `vidalyticsContainerId(embedId)`, never the raw embed id.
 *
 * Never rejects: a player that never loads (blocked script, dead embed id)
 * leaves the promise pending forever, which for a fire-and-forget analytics
 * listener is the correct amount of noise. Callers must not await it in a path
 * that has to finish.
 */
export function getVidalyticsPlayer(
  containerId: string,
): Promise<VidalyticsPlayer> {
  const scope = window as VidalyticsWindow;
  const vidalytics = (scope._vidalytics ??= {});
  const embeds = (vidalytics.embeds ??= {});
  const slot = (embeds[containerId] ??= {});

  return new Promise((resolve) => {
    // Already loaded — the common case when a visitor scrolls back to a video
    // they have played before.
    if (slot.player) {
      resolve(slot.player);
      return;
    }

    let player: VidalyticsPlayer | undefined;
    Object.defineProperty(slot, "player", {
      configurable: true,
      get: () => player,
      set(value: VidalyticsPlayer) {
        player = value;
        resolve(value);
      },
    });
  });
}
