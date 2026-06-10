import { describe, expect, it } from "vitest";
import {
  computeWalkthroughCardPlacement,
  WALKTHROUGH_CARD_DIMENSIONS,
  type Rect,
  type Viewport,
} from "./walkthrough-card-position";

const VIEWPORT: Viewport = { width: 1440, height: 900 };

function rect(partial: Partial<Rect>): Rect {
  const top = partial.top ?? 0;
  const left = partial.left ?? 0;
  const width = partial.width ?? 0;
  const height = partial.height ?? 0;
  return {
    top,
    left,
    width,
    height,
    bottom: partial.bottom ?? top + height,
    right: partial.right ?? left + width,
  };
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

function cardRect(left: number, top: number): Rect {
  return rect({
    top,
    left,
    width: WALKTHROUGH_CARD_DIMENSIONS.width,
    height: WALKTHROUGH_CARD_DIMENSIONS.height,
  });
}

describe("computeWalkthroughCardPlacement", () => {
  it("places the card beside a full-viewport-height target without overlapping it", () => {
    // The step-1 blocks rail: a tall, left-pinned panel spanning the viewport.
    const railTarget = rect({
      top: 0,
      left: 0,
      width: 280,
      height: VIEWPORT.height,
    });

    const placement = computeWalkthroughCardPlacement(railTarget, VIEWPORT);
    const card = cardRect(placement.left, placement.top);

    expect(intersects(card, railTarget)).toBe(false);
    // Card stays inside the viewport.
    expect(card.left).toBeGreaterThanOrEqual(0);
    expect(card.right).toBeLessThanOrEqual(VIEWPORT.width);
    expect(card.top).toBeGreaterThanOrEqual(0);
    expect(card.bottom).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it("places the card beside a right-pinned full-height target", () => {
    const rightRail = rect({
      top: 0,
      left: VIEWPORT.width - 320,
      width: 320,
      height: VIEWPORT.height,
    });

    const placement = computeWalkthroughCardPlacement(rightRail, VIEWPORT);
    const card = cardRect(placement.left, placement.top);

    expect(intersects(card, rightRail)).toBe(false);
    expect(card.left).toBeGreaterThanOrEqual(0);
    expect(card.right).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it("keeps placing the card below a short target near the top (normal behavior)", () => {
    const button = rect({ top: 80, left: 200, width: 160, height: 40 });

    const placement = computeWalkthroughCardPlacement(button, VIEWPORT);

    // Below the target with the standard gap.
    expect(placement.top).toBe(button.bottom + 16);
    expect(placement.left).toBe(button.left);
  });

  it("places a short target near the bottom above itself (normal behavior)", () => {
    const button = rect({ top: 820, left: 200, width: 160, height: 40 });

    const placement = computeWalkthroughCardPlacement(button, VIEWPORT);
    const card = cardRect(placement.left, placement.top);

    // Not enough room below, so it flips above and stays in the viewport.
    expect(placement.top).toBeLessThan(button.top);
    expect(card.top).toBeGreaterThanOrEqual(0);
  });
});
