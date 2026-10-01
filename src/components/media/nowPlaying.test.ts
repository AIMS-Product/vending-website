import { describe, expect, it, vi } from "vitest";
import { claim, subscribe } from "./nowPlaying";

describe("nowPlaying channel", () => {
  it("tells every subscriber which player claimed", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribe(a);
    const offB = subscribe(b);

    claim("player-1");

    expect(a).toHaveBeenCalledWith("player-1");
    expect(b).toHaveBeenCalledWith("player-1");
    offA();
    offB();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const off = subscribe(listener);
    off();

    claim("player-2");

    expect(listener).not.toHaveBeenCalled();
  });

  it("lets a listener unsubscribe while a claim is being delivered", () => {
    const later = vi.fn();
    const off = subscribe(() => off());
    const offLater = subscribe(later);

    claim("player-3");

    expect(later).toHaveBeenCalledWith("player-3");
    offLater();
  });

  it("lets only the claiming player keep playing", () => {
    const playing = new Set(["a", "b", "c"]);
    const offs = ["a", "b", "c"].map((id) =>
      subscribe((claimed) => {
        if (claimed !== id) playing.delete(id);
      }),
    );

    claim("b");

    expect([...playing]).toEqual(["b"]);
    offs.forEach((off) => off());
  });
});
