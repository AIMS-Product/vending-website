/**
 * One "now playing" channel for every video on a page.
 *
 * Players on the funnel pages are independent embeds (Vidalytics, YouTube),
 * so starting one never stopped another and several could play with sound at
 * once. A player calls `claim(id)` when the visitor starts it; every other
 * player subscribed here hears that id and stops itself.
 *
 * Module-level on purpose: the players live in unrelated parts of the tree
 * and a page only ever has one audio output to share.
 */

type Listener = (playingId: string) => void;

const listeners = new Set<Listener>();

/** Marks `id` as the one playing source and tells every listener. */
export function claim(id: string): void {
  // Copy first: a listener may unsubscribe (unmount) while we iterate.
  for (const listener of [...listeners]) listener(id);
}

/**
 * Calls `listener` with the claiming id on every claim. Listeners compare it
 * with their own id and stop when it differs. Returns an unsubscribe.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
