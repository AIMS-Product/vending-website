"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ClickToLoad, type PlayButtonVariant } from "./ClickToLoad";
import { WhenNearViewport } from "./WhenNearViewport";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
// Unknown on the server. Treating it as "no preference" let the autoplaying
// snippet mount during hydration, before the client value arrived, so a
// reduced-motion visitor could still get a muted autoplay. Nothing loads
// until the browser has answered.
const serverSnapshot = () => null;

/**
 * Decides when a player's embed snippet runs. "near" loads it as the player
 * approaches the viewport, and the player autoplays; "click" waits behind a
 * play button. A visitor who asks for reduced motion always gets the play
 * button, because the snippet autoplays the moment it runs.
 */
export function AutoplayGate({
  loadOn,
  targetId,
  label,
  variant,
  children,
}: {
  loadOn: "near" | "click";
  targetId: string;
  label: string;
  variant: PlayButtonVariant;
  children: ReactNode;
}) {
  const reduced = useSyncExternalStore<boolean | null>(
    subscribe,
    prefersReducedMotion,
    serverSnapshot,
  );

  if (loadOn === "near" && reduced === null) return null;
  if (loadOn === "click" || reduced) {
    return (
      <ClickToLoad label={label} variant={variant} focusTargetId={targetId}>
        {children}
      </ClickToLoad>
    );
  }
  return <WhenNearViewport targetId={targetId}>{children}</WhenNearViewport>;
}
