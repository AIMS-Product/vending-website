export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export type Viewport = {
  width: number;
  height: number;
};

export type CardPlacement = {
  top: number;
  left: number;
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 180;
const VIEWPORT_PADDING = 16;
const CARD_GAP = 16;

/**
 * A target counts as "tall" when it occupies most of the viewport height (e.g.
 * the full-height left blocks rail). Placing the card above/below such a target
 * is impossible without overlapping it, so it must sit beside the target.
 */
const TALL_TARGET_RATIO = 0.6;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes the top/left for the walkthrough card so it does not overlap the
 * highlighted target. Normal targets keep the existing below/above behavior;
 * tall targets (like the full-height rail) are placed beside the target.
 */
export function computeWalkthroughCardPlacement(
  targetRect: Rect,
  viewport: Viewport,
): CardPlacement {
  const isTallTarget = targetRect.height >= viewport.height * TALL_TARGET_RATIO;

  if (isTallTarget) {
    return placeBesideTarget(targetRect, viewport);
  }

  return placeBelowOrAboveTarget(targetRect, viewport);
}

function placeBelowOrAboveTarget(
  targetRect: Rect,
  viewport: Viewport,
): CardPlacement {
  const preferredTop = targetRect.bottom + CARD_GAP;
  const fitsBelow =
    preferredTop + CARD_HEIGHT <= viewport.height - VIEWPORT_PADDING;
  const top = fitsBelow
    ? preferredTop
    : Math.max(VIEWPORT_PADDING, targetRect.top - CARD_HEIGHT);
  const left = clamp(
    targetRect.left,
    VIEWPORT_PADDING,
    viewport.width - CARD_WIDTH - VIEWPORT_PADDING,
  );

  return { top, left };
}

function placeBesideTarget(
  targetRect: Rect,
  viewport: Viewport,
): CardPlacement {
  const maxLeft = viewport.width - CARD_WIDTH - VIEWPORT_PADDING;

  // Prefer the right side of the target; fall back to the left if the card
  // would not fit on the right (e.g. a full-height rail pinned to the right).
  const rightOfTarget = targetRect.right + CARD_GAP;
  const fitsRight = rightOfTarget <= maxLeft;
  const left = fitsRight
    ? rightOfTarget
    : clamp(targetRect.left - CARD_GAP - CARD_WIDTH, VIEWPORT_PADDING, maxLeft);

  const top = clamp(
    targetRect.top,
    VIEWPORT_PADDING,
    Math.max(
      VIEWPORT_PADDING,
      viewport.height - CARD_HEIGHT - VIEWPORT_PADDING,
    ),
  );

  return { top, left };
}

export const WALKTHROUGH_CARD_DIMENSIONS = {
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
} as const;
