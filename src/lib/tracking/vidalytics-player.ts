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
 * Docs: https://player-docs.vidalytics.com/api/getting-started
 */

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
};

type VidalyticsEmbedSlot = { player?: VidalyticsPlayer };
type VidalyticsWindow = Window & {
  _vidalytics?: { embeds?: Record<string, VidalyticsEmbedSlot> };
};

/**
 * Resolves with the player for `embedId` once it exists.
 *
 * Never rejects: a player that never loads (blocked script, dead embed id)
 * leaves the promise pending forever, which for a fire-and-forget analytics
 * listener is the correct amount of noise. Callers must not await it in a path
 * that has to finish.
 */
export function getVidalyticsPlayer(
  embedId: string,
): Promise<VidalyticsPlayer> {
  const scope = window as VidalyticsWindow;
  const vidalytics = (scope._vidalytics ??= {});
  const embeds = (vidalytics.embeds ??= {});
  const slot = (embeds[embedId] ??= {});

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
